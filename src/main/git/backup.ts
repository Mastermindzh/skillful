import { spawn } from "node:child_process";
import { copyFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { AppError } from "../../shared/errors";
import { LIBRARY_ITEM_KINDS } from "../../shared/library";
import type {
  AppConfig,
  GitBackupConfig,
  GitBackupResult,
  GitBackupState,
  GitBackupStatus,
} from "../../shared/types";
import { copyRelativeFiles, ensureDirectory, pathExists } from "../fs";
import { libraryRootPath } from "../libraryPaths";
import { configFilePath, defaultSkillRoot } from "../settings";

const GIT_TIMEOUT_MS = 120_000;
const BACKUP_SNAPSHOT_ENTRIES = ["settings.json", "skills", "agents"];
const MANAGED_GIT_PATHS = [".gitignore", ...BACKUP_SNAPSHOT_ENTRIES];

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
    repositoryPath: config.repositoryPath,
    remoteUrl: config.remoteUrl,
    branch: config.branch,
    message: "Git backup is disabled.",
  };
}

function notConfiguredStatus(config: GitBackupConfig, message = "Git backup is not configured.") {
  return {
    state: "not-configured" as const,
    repositoryPath: config.repositoryPath,
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

  const repositoryPath = config.repositoryPath.trim();
  const remoteUrl = config.remoteUrl.trim();
  const branch = cleanBranch(config.branch);

  if (!repositoryPath || !remoteUrl || !branch) {
    return notConfiguredStatus(config);
  }

  if (!path.isAbsolute(repositoryPath)) {
    throw new AppError("invalid-path", "Backup repository path must be absolute.", {
      path: repositoryPath,
    });
  }

  if (/\s/.test(branch)) {
    throw new AppError("invalid-name", "Backup branch cannot contain whitespace.");
  }

  return null;
}

function gitEnv() {
  return {
    ...process.env,
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
    repositoryPath: config.repositoryPath,
    remoteUrl: config.remoteUrl,
    branch: config.branch,
    message: message || "Git backup failed.",
  };
}

function libraryBackupDirectory(kind: (typeof LIBRARY_ITEM_KINDS)[number]) {
  return kind === "skill" ? "skills" : "agents";
}

async function copySettingsSnapshot(repositoryPath: string) {
  if (!(await pathExists(configFilePath()))) return;
  const targetPath = path.join(repositoryPath, "settings.json");
  await ensureDirectory(path.dirname(targetPath));
  await copyFile(configFilePath(), targetPath);
}

async function copyDefaultLibrarySnapshot(repositoryPath: string) {
  for (const kind of LIBRARY_ITEM_KINDS) {
    await copyRelativeFiles(
      libraryRootPath(defaultSkillRoot(), kind),
      path.join(repositoryPath, libraryBackupDirectory(kind)),
      { overwrite: true }
    );
  }
}

async function clearManagedSnapshot(repositoryPath: string) {
  for (const entry of BACKUP_SNAPSHOT_ENTRIES) {
    await rm(path.join(repositoryPath, entry), { recursive: true, force: true });
  }
}

async function writeGitIgnore(repositoryPath: string) {
  await writeFile(
    path.join(repositoryPath, ".gitignore"),
    ["# Skillful git backup repository", ".DS_Store", "Thumbs.db", "*.tmp", ""].join("\n"),
    "utf8"
  );
}

async function writeBackupSnapshot(config: AppConfig) {
  const repositoryPath = config.gitBackup.repositoryPath.trim();
  await clearManagedSnapshot(repositoryPath);

  if (config.gitBackup.includeSettings) await copySettingsSnapshot(repositoryPath);
  if (config.gitBackup.includeDefaultLibrary) await copyDefaultLibrarySnapshot(repositoryPath);

  await writeGitIgnore(repositoryPath);
}

async function managedGitPathspecs(repositoryPath: string) {
  const trackedResult = await runGit(
    ["ls-files", "--", ...MANAGED_GIT_PATHS],
    repositoryPath
  ).catch(() => ({ stdout: "" }));
  const trackedPaths = trackedResult.stdout
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean);
  const pathspecs: string[] = [];

  for (const managedPath of MANAGED_GIT_PATHS) {
    const tracked = trackedPaths.some(
      (entry) => entry === managedPath || entry.startsWith(`${managedPath}/`)
    );
    if (tracked || (await pathExists(path.join(repositoryPath, managedPath)))) {
      pathspecs.push(managedPath);
    }
  }

  return pathspecs;
}

async function ensureGitIdentity(repositoryPath: string) {
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

async function ensureBackupRepository(config: GitBackupConfig) {
  const repositoryPath = config.repositoryPath.trim();
  const remoteUrl = config.remoteUrl.trim();
  const branch = cleanBranch(config.branch);
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

  await runGit(["checkout", "-B", branch], repositoryPath);
  await ensureGitIdentity(repositoryPath);
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
    repositoryPath: config.repositoryPath,
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

  const repositoryPath = config.gitBackup.repositoryPath.trim();
  const branch = cleanBranch(config.gitBackup.branch);

  try {
    await ensureBackupRepository(config.gitBackup);
    await writeBackupSnapshot(config);
    await runGit(
      ["add", "--all", "--", ...(await managedGitPathspecs(repositoryPath))],
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
