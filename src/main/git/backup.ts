import { spawn } from "node:child_process";
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

const GIT_TIMEOUT_MS = 120_000;
const SETTINGS_GIT_PATH = "settings.json";
const DEFAULT_LIBRARY_GIT_PATHS = ["skills", "agents"];
const MANAGED_GIT_PATHS = [".gitignore", SETTINGS_GIT_PATH, ...DEFAULT_LIBRARY_GIT_PATHS];

type GitCommandResult = {
  stdout: string;
  stderr: string;
};

class GitCommandError extends Error {
  readonly code: number | null;
  readonly stdout: string;
  readonly stderr: string;

  constructor(message: string, code: number | null, stdout: string, stderr: string) {
    super(message);
    this.name = "GitCommandError";
    this.code = code;
    this.stdout = stdout;
    this.stderr = stderr;
  }
}

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

function cleanBranch(value: string) {
  return value.trim();
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

  return null;
}

function gitEnv() {
  return {
    ...process.env,
    GCM_INTERACTIVE: "never",
    GIT_TERMINAL_PROMPT: "0",
  };
}

function sanitizedGitMessage(message: string, remoteUrl: string) {
  return message
    .split(remoteUrl)
    .join("[remote]")
    .replace(/https:\/\/[^/@\s]+@/g, "https://[credentials]@")
    .trim();
}

function runCommand(command: string, args: string[], cwd?: string): Promise<GitCommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: gitEnv(),
      shell: false,
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const timer = setTimeout(() => {
      settled = true;
      child.kill("SIGTERM");
      reject(new GitCommandError(`${command} timed out.`, null, stdout, stderr));
    }, GIT_TIMEOUT_MS);

    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      if (settled) return;
      settled = true;
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (settled) return;
      settled = true;
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(new GitCommandError(`${command} exited with code ${code}.`, code, stdout, stderr));
    });
  });
}

async function runGit(args: string[], cwd?: string) {
  return runCommand("git", args, cwd);
}

async function gitAvailable() {
  try {
    await runGit(["--version"]);
    return true;
  } catch {
    return false;
  }
}

function mapGitFailure(error: unknown, config: GitBackupConfig): GitBackupStatus {
  const remoteUrl = config.remoteUrl.trim();
  const rawMessage =
    error instanceof GitCommandError
      ? `${error.stderr || error.stdout || error.message}`
      : error instanceof Error
        ? error.message
        : String(error);
  const message = sanitizedGitMessage(rawMessage, remoteUrl);
  const lower = message.toLowerCase();
  let state: GitBackupState = "error";

  if (
    lower.includes("permission denied") ||
    lower.includes("authentication failed") ||
    lower.includes("publickey") ||
    lower.includes("could not read username") ||
    lower.includes("could not read password") ||
    lower.includes("interactivity has been disabled") ||
    lower.includes("terminal prompts disabled")
  ) {
    state = "auth-failed";
  } else if (
    lower.includes("could not resolve hostname") ||
    lower.includes("could not read from remote repository") ||
    lower.includes("repository not found") ||
    lower.includes("failed to connect") ||
    lower.includes("unable to access")
  ) {
    state = "remote-unreachable";
  }

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
