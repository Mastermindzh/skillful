import { readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { AppError } from "../../shared/errors";
import type {
  AppConfig,
  GitBackupConfig,
  GitBackupRestoreMode,
  GitBackupRestoreResult,
  GitBackupResult,
  GitBackupState,
  GitBackupStatus,
} from "../../shared/types";
import { ensureDirectory, pathExists } from "../fs";
import { settingsDirectory } from "../settings";
import {
  classifyGitFailure,
  cleanBranch,
  GitCommandError,
  gitAvailable,
  gitErrorMessage,
  runGit,
  validateRemoteUrlTransport,
} from "./command";

const SETTINGS_GIT_PATH = "settings.json";
const DEFAULT_LIBRARY_GIT_PATHS = ["skills", "agents"];
const MANAGED_GIT_PATHS = [".gitignore", SETTINGS_GIT_PATH, ...DEFAULT_LIBRARY_GIT_PATHS];

function disabledStatus(config: GitBackupConfig): GitBackupStatus {
  return {
    state: "disabled",
    remoteUrl: config.remoteUrl,
    branch: config.branch,
    message: "Git backup is disabled.",
  };
}

function notConfiguredStatus(config: GitBackupConfig, message = "Git backup is not configured.") {
  return {
    state: "not-configured" as const,
    remoteUrl: config.remoteUrl,
    branch: config.branch,
    message,
  };
}

function validateConfiguredBackup(config: GitBackupConfig) {
  if (!config.enabled) return disabledStatus(config);

  const remoteUrl = config.remoteUrl.trim();
  const branch = cleanBranch(config.branch);

  if (!remoteUrl || !branch) {
    return notConfiguredStatus(config);
  }

  if (/\s/.test(branch)) {
    throw new AppError("invalid-name", "Backup branch cannot contain whitespace.");
  }

  validateRemoteUrlTransport(remoteUrl);

  return null;
}

function mapGitFailure(error: unknown, config: GitBackupConfig): GitBackupStatus {
  const message = gitErrorMessage(error, config.remoteUrl);
  const kind = classifyGitFailure(message);
  // Backups have no host-trust prompt, so an unverified host reads as an auth problem.
  const state: GitBackupState = kind === "host-key-unverified" ? "auth-failed" : kind;

  return {
    state,
    remoteUrl: config.remoteUrl,
    branch: config.branch,
    message: message || "Git backup failed.",
  };
}

function includedManagedGitPaths(config: GitBackupConfig) {
  return [
    ".gitignore",
    ...(config.includeSettings ? [SETTINGS_GIT_PATH] : []),
    ...(config.includeDefaultLibrary ? DEFAULT_LIBRARY_GIT_PATHS : []),
  ];
}

function excludedManagedGitPaths(config: GitBackupConfig) {
  return [
    ...(!config.includeSettings ? [SETTINGS_GIT_PATH] : []),
    ...(!config.includeDefaultLibrary ? DEFAULT_LIBRARY_GIT_PATHS : []),
  ];
}

function gitIgnoreUnignorePatterns(managedPath: string) {
  if (DEFAULT_LIBRARY_GIT_PATHS.includes(managedPath)) {
    return [`!/${managedPath}/`, `!/${managedPath}/**`];
  }
  return [`!/${managedPath}`];
}

async function writeGitIgnore(config: GitBackupConfig) {
  const unignoredPaths = includedManagedGitPaths(config).flatMap(gitIgnoreUnignorePatterns);
  await writeFile(
    path.join(settingsDirectory(), ".gitignore"),
    ["# Skillful git backup repository", "*", ...unignoredPaths, ""].join("\n"),
    "utf8"
  );
}

async function writeBackupSnapshot(config: AppConfig) {
  await writeGitIgnore(config.gitBackup);
}

async function managedGitPathspecs(config: GitBackupConfig) {
  const repositoryPath = settingsDirectory();
  const managedPaths = includedManagedGitPaths(config);
  const trackedResult = await runGit(
    ["ls-files", "--", ...MANAGED_GIT_PATHS],
    repositoryPath
  ).catch(() => ({ stdout: "" }));
  const trackedPaths = trackedResult.stdout
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean);
  const pathspecs: string[] = [];

  for (const managedPath of managedPaths) {
    const tracked = trackedPaths.some(
      (entry) => entry === managedPath || entry.startsWith(`${managedPath}/`)
    );
    if (tracked || (await pathExists(path.join(repositoryPath, managedPath)))) {
      pathspecs.push(managedPath);
    }
  }

  return pathspecs;
}

async function untrackExcludedManagedPaths(config: GitBackupConfig) {
  const excludedPaths = excludedManagedGitPaths(config);
  if (excludedPaths.length === 0) return;
  await runGit(
    ["rm", "--cached", "-r", "--ignore-unmatch", "--", ...excludedPaths],
    settingsDirectory()
  );
}

async function ensureGitIdentity(repositoryPath = settingsDirectory()) {
  const userName = await runGit(["config", "--get", "user.name"], repositoryPath).catch(() => null);
  if (!userName?.stdout.trim()) {
    await runGit(["config", "user.name", "Skillful Backup"], repositoryPath);
  }
  const userEmail = await runGit(["config", "--get", "user.email"], repositoryPath).catch(
    () => null
  );
  if (!userEmail?.stdout.trim()) {
    await runGit(["config", "user.email", "skillful-backup@localhost"], repositoryPath);
  }
}

async function configureBackupRemote(config: GitBackupConfig) {
  const repositoryPath = settingsDirectory();
  const remoteUrl = config.remoteUrl.trim();
  await ensureDirectory(repositoryPath);
  await runGit(["init"], repositoryPath);

  const currentRemote = await runGit(["remote", "get-url", "origin"], repositoryPath).catch(
    () => null
  );
  if (currentRemote?.stdout.trim()) {
    if (currentRemote.stdout.trim() !== remoteUrl) {
      await runGit(["remote", "set-url", "origin", remoteUrl], repositoryPath);
    }
  } else {
    await runGit(["remote", "add", "origin", remoteUrl], repositoryPath);
  }
}

async function ensureBackupRepository(config: GitBackupConfig) {
  const repositoryPath = settingsDirectory();
  const branch = cleanBranch(config.branch);
  await configureBackupRemote(config);
  await runGit(["checkout", "-B", branch], repositoryPath);
  await ensureGitIdentity(repositoryPath);
}

async function directoryHasEntries(dirPath: string) {
  try {
    const entries = await readdir(dirPath);
    return entries.length > 0;
  } catch {
    return false;
  }
}

async function localLibraryContentPaths() {
  const root = settingsDirectory();
  const paths: string[] = [];
  for (const relativePath of DEFAULT_LIBRARY_GIT_PATHS) {
    if (await directoryHasEntries(path.join(root, relativePath))) {
      paths.push(relativePath);
    }
  }
  return paths;
}

async function removeManagedRestoreTargets() {
  const root = settingsDirectory();
  for (const relativePath of MANAGED_GIT_PATHS) {
    await rm(path.join(root, relativePath), { recursive: true, force: true });
  }
}

async function remoteManagedPaths(branch: string) {
  const remoteRef = `origin/${branch}`;
  const result = await runGit(
    ["ls-tree", "-r", "--name-only", remoteRef, "--", ...MANAGED_GIT_PATHS],
    settingsDirectory()
  );
  return result.stdout
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function managedRestorePaths(restoredPaths: string[]) {
  return MANAGED_GIT_PATHS.filter((managedPath) =>
    restoredPaths.some((entry) => entry === managedPath || entry.startsWith(`${managedPath}/`))
  );
}

async function remoteDefaultBranch(config: GitBackupConfig) {
  const result = await runGit(["ls-remote", "--symref", config.remoteUrl.trim(), "HEAD"]);
  const match = result.stdout.match(/^ref:\s+refs\/heads\/(.+)\s+HEAD/m);
  return match?.[1]?.trim() || null;
}

async function stagedChangesExist(repositoryPath: string) {
  try {
    await runGit(["diff", "--cached", "--quiet"], repositoryPath);
    return false;
  } catch (error) {
    if (error instanceof GitCommandError && error.code === 1) return true;
    throw error;
  }
}

async function currentCommit(repositoryPath: string) {
  const result = await runGit(["rev-parse", "--short", "HEAD"], repositoryPath).catch(() => null);
  return result?.stdout.trim() || undefined;
}

function baseStatus(config: GitBackupConfig, state: GitBackupState): GitBackupStatus {
  return {
    state,
    remoteUrl: config.remoteUrl,
    branch: config.branch,
  };
}

export async function initializeGitBackup(config: GitBackupConfig): Promise<GitBackupResult> {
  const invalid = validateConfiguredBackup(config);
  if (invalid) return { ...invalid, changed: false, pushed: false };
  if (!(await gitAvailable())) {
    return {
      ...baseStatus(config, "missing-git"),
      changed: false,
      pushed: false,
      message: "Git is not available on this system.",
    };
  }

  try {
    await runGit(["ls-remote", "--heads", config.remoteUrl.trim()]);
    return {
      ...baseStatus(config, "ready"),
      changed: false,
      pushed: false,
      message: "Backup repository is ready.",
    };
  } catch (error) {
    return { ...mapGitFailure(error, config), changed: false, pushed: false };
  }
}

export async function restoreGitBackup(
  config: GitBackupConfig,
  mode: GitBackupRestoreMode
): Promise<GitBackupRestoreResult> {
  const invalid = validateConfiguredBackup(config);
  if (invalid) {
    return {
      ...invalid,
      restored: false,
      localContentFound: false,
      restoredPaths: [],
    };
  }
  if (!(await gitAvailable())) {
    return {
      ...baseStatus(config, "missing-git"),
      restored: false,
      localContentFound: false,
      restoredPaths: [],
      message: "Git is not available on this system.",
    };
  }

  const branch =
    (await remoteDefaultBranch(config).catch(() => null)) ?? cleanBranch(config.branch);
  const restoreConfig = { ...config, branch };

  try {
    const localContentPaths = await localLibraryContentPaths();
    if (localContentPaths.length > 0 && mode !== "replace") {
      throw new AppError(
        "git-restore-local-content",
        "Local skills or agents already exist. Confirm before replacing them from git.",
        { paths: localContentPaths }
      );
    }

    await configureBackupRemote(config);
    await runGit(
      ["fetch", "origin", `${branch}:refs/remotes/origin/${branch}`],
      settingsDirectory()
    );

    const restoredPaths = await remoteManagedPaths(branch);
    if (restoredPaths.length === 0) {
      throw new AppError(
        "git-restore-invalid-remote",
        "The selected branch does not look like a Skillful backup."
      );
    }

    await removeManagedRestoreTargets();
    await runGit(["checkout", "-B", branch, `origin/${branch}`], settingsDirectory());
    await runGit(
      ["checkout", `origin/${branch}`, "--", ...managedRestorePaths(restoredPaths)],
      settingsDirectory()
    );
    await ensureGitIdentity();

    return {
      ...baseStatus(restoreConfig, "ready"),
      restored: true,
      localContentFound: localContentPaths.length > 0,
      restoredPaths,
      message: "Backup restored.",
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    const status = mapGitFailure(error, config);
    return {
      ...status,
      restored: false,
      localContentFound: false,
      restoredPaths: [],
    };
  }
}

export async function runGitBackup(config: AppConfig): Promise<GitBackupResult> {
  const invalid = validateConfiguredBackup(config.gitBackup);
  if (invalid) return { ...invalid, changed: false, pushed: false };
  if (!(await gitAvailable())) {
    return {
      ...baseStatus(config.gitBackup, "missing-git"),
      changed: false,
      pushed: false,
      message: "Git is not available on this system.",
    };
  }

  const repositoryPath = settingsDirectory();
  const branch = cleanBranch(config.gitBackup.branch);

  try {
    await ensureBackupRepository(config.gitBackup);
    await writeBackupSnapshot(config);
    await untrackExcludedManagedPaths(config.gitBackup);
    await runGit(
      ["add", "--all", "--", ...(await managedGitPathspecs(config.gitBackup))],
      repositoryPath
    );

    if (!(await stagedChangesExist(repositoryPath))) {
      return {
        ...baseStatus(config.gitBackup, "up-to-date"),
        lastCommit: await currentCommit(repositoryPath),
        changed: false,
        pushed: false,
        message: "Backup is already up to date.",
      };
    }

    const backedUpAt = new Date().toISOString();
    await runGit(["commit", "-m", `Skillful backup ${backedUpAt}`], repositoryPath);
    await runGit(["push", "-u", "origin", branch], repositoryPath);

    return {
      ...baseStatus(config.gitBackup, "ready"),
      lastCommit: await currentCommit(repositoryPath),
      lastBackupAt: backedUpAt,
      changed: true,
      pushed: true,
      message: "Backup pushed.",
    };
  } catch (error) {
    const status = mapGitFailure(error, config.gitBackup);
    return { ...status, changed: false, pushed: false };
  }
}
