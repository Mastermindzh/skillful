import { readdir } from "node:fs/promises";
import path from "node:path";
import { AppError } from "../../shared/errors";
import { parseScpRemote } from "../../shared/gitRemote";
import type {
  GitLibraryChange,
  GitLibraryConfig,
  GitLibrarySyncResult,
  GitLibrarySyncState,
} from "../../shared/types";
import { ensureDirectory, pathExists } from "../fs";
import {
  classifyGitFailure,
  cleanBranch,
  gitAvailable,
  gitErrorMessage,
  runGit,
  validateRemoteUrlTransport,
} from "./command";

/** Caps the change list sent to the renderer; the count is what the UI actually needs. */
const MAX_REPORTED_CHANGES = 200;

function baseResult(
  library: GitLibraryConfig,
  targetPath: string,
  state: GitLibrarySyncState,
): GitLibrarySyncResult {
  return {
    libraryId: library.id,
    state,
    path: targetPath,
    remoteUrl: library.remoteUrl,
    branch: library.branch,
    cloned: false,
    pulled: false,
    pushed: false,
    localChanges: [],
  };
}

function failureResult(
  library: GitLibraryConfig,
  targetPath: string,
  error: unknown,
): GitLibrarySyncResult {
  const message = gitErrorMessage(error, library.remoteUrl);
  const state = classifyGitFailure(message);
  return {
    ...baseResult(library, targetPath, state),
    host:
      state === "host-key-unverified"
        ? (sshHost(library.remoteUrl) ?? undefined)
        : undefined,
    message: message || "Git sync failed.",
  };
}

/** Extracts the ssh host from `ssh://user@host:port/path` or scp-style `user@host:path`. */
export function sshHost(remoteUrl: string): string | null {
  const value = remoteUrl.trim();
  if (!value) return null;

  if (value.startsWith("ssh://")) {
    try {
      return new URL(value).hostname || null;
    } catch {
      return null;
    }
  }

  const scpLike = parseScpRemote(value);
  return scpLike?.host ?? null;
}

function validateLibrary(library: GitLibraryConfig) {
  const remoteUrl = library.remoteUrl.trim();
  const branch = cleanBranch(library.branch);
  if (!remoteUrl || !branch) return false;
  if (/\s/.test(branch)) {
    throw new AppError(
      "invalid-name",
      "Git library branch cannot contain whitespace.",
    );
  }
  validateRemoteUrlTransport(remoteUrl);
  return true;
}

async function isGitRepository(targetPath: string) {
  return pathExists(path.join(targetPath, ".git"));
}

async function directoryIsEmpty(targetPath: string) {
  try {
    const entries = await readdir(targetPath);
    return entries.length === 0;
  } catch {
    return true;
  }
}

function parsePorcelain(stdout: string): GitLibraryChange[] {
  return stdout
    .split("\0")
    .filter(Boolean)
    .slice(0, MAX_REPORTED_CHANGES)
    .map((entry) => ({
      status: entry.slice(0, 2).trim() || "?",
      relativePath: entry.slice(3),
    }));
}

async function localChanges(targetPath: string) {
  const result = await runGit(
    ["status", "--porcelain", "-z", "--untracked-files=all"],
    targetPath,
  );
  return parsePorcelain(result.stdout);
}

async function currentCommit(targetPath: string) {
  const result = await runGit(
    ["rev-parse", "--short", "HEAD"],
    targetPath,
  ).catch(() => null);
  return result?.stdout.trim() || undefined;
}

async function commitsBetween(targetPath: string, from: string, to: string) {
  const result = await runGit(
    ["rev-list", "--count", `${from}..${to}`],
    targetPath,
  ).catch(() => null);
  return Number.parseInt(result?.stdout.trim() ?? "0", 10) || 0;
}

async function ensureIdentity(targetPath: string) {
  const userName = await runGit(
    ["config", "--get", "user.name"],
    targetPath,
  ).catch(() => null);
  if (!userName?.stdout.trim()) {
    await runGit(["config", "user.name", "Skillful"], targetPath);
  }
  const userEmail = await runGit(
    ["config", "--get", "user.email"],
    targetPath,
  ).catch(() => null);
  if (!userEmail?.stdout.trim()) {
    await runGit(["config", "user.email", "skillful@localhost"], targetPath);
  }
}

async function ensureRemote(library: GitLibraryConfig, targetPath: string) {
  const remoteUrl = library.remoteUrl.trim();
  const current = await runGit(
    ["remote", "get-url", "origin"],
    targetPath,
  ).catch(() => null);
  if (!current?.stdout.trim()) {
    await runGit(["remote", "add", "origin", remoteUrl], targetPath);
    return;
  }
  if (current.stdout.trim() !== remoteUrl) {
    await runGit(["remote", "set-url", "origin", remoteUrl], targetPath);
  }
}

async function cloneLibrary(library: GitLibraryConfig, targetPath: string) {
  const branch = cleanBranch(library.branch);
  await ensureDirectory(path.dirname(targetPath));
  if ((await pathExists(targetPath)) && !(await directoryIsEmpty(targetPath))) {
    throw new AppError(
      "invalid-path",
      "The folder for this git library already exists and is not empty.",
    );
  }
  await runGit([
    "clone",
    "--branch",
    branch,
    "--single-branch",
    library.remoteUrl.trim(),
    targetPath,
  ]);
  await ensureIdentity(targetPath);
}

/**
 * Reports what a git library looks like on disk without touching the network, so the UI can
 * offer "push local changes" without waiting on (or failing because of) a remote.
 */
export async function readGitLibraryStatus(
  library: GitLibraryConfig,
  targetPath: string,
): Promise<GitLibrarySyncResult> {
  try {
    if (!validateLibrary(library)) {
      return baseResult(library, targetPath, "not-configured");
    }
    if (!(await isGitRepository(targetPath))) {
      return baseResult(library, targetPath, "not-cloned");
    }

    const changes = await localChanges(targetPath);
    const ahead = await commitsBetween(
      targetPath,
      `origin/${cleanBranch(library.branch)}`,
      "HEAD",
    );
    const state: GitLibrarySyncState =
      changes.length > 0 || ahead > 0 ? "local-changes" : "up-to-date";
    return {
      ...baseResult(library, targetPath, state),
      localChanges: changes,
      lastCommit: await currentCommit(targetPath),
    };
  } catch (error) {
    return failureResult(library, targetPath, error);
  }
}

/**
 * Brings a git library in line with its remote.
 *
 * `pull` mode only ever fast-forwards: a dirty working tree is reported as `local-changes` and
 * left untouched so nothing the user wrote is lost. `two-way` mode commits and pushes local work
 * as part of the same run. Anything that cannot be resolved without a judgement call (diverged
 * history, merge conflicts) comes back as `diverged` for the user to handle.
 */
export async function syncGitLibrary(
  library: GitLibraryConfig,
  targetPath: string,
): Promise<GitLibrarySyncResult> {
  try {
    if (!validateLibrary(library)) {
      return baseResult(library, targetPath, "not-configured");
    }
    if (!(await gitAvailable())) {
      return {
        ...baseResult(library, targetPath, "missing-git"),
        message: "Git is not available on this system.",
      };
    }

    const branch = cleanBranch(library.branch);
    const remoteRef = `origin/${branch}`;

    if (!(await isGitRepository(targetPath))) {
      await cloneLibrary(library, targetPath);
      return {
        ...baseResult(library, targetPath, "up-to-date"),
        cloned: true,
        pulled: true,
        lastCommit: await currentCommit(targetPath),
        syncedAt: new Date().toISOString(),
      };
    }

    await ensureRemote(library, targetPath);
    await ensureIdentity(targetPath);
    await runGit(["fetch", "origin", branch], targetPath);

    const changes = await localChanges(targetPath);
    const committed = library.syncMode === "two-way" && changes.length > 0;
    if (committed) {
      await runGit(["add", "--all"], targetPath);
      await runGit(
        ["commit", "-m", `Skillful sync ${new Date().toISOString()}`],
        targetPath,
      );
    } else if (changes.length > 0) {
      return {
        ...baseResult(library, targetPath, "local-changes"),
        localChanges: changes,
        lastCommit: await currentCommit(targetPath),
        message: "Local changes are waiting to be pushed.",
      };
    }

    const behind = await commitsBetween(targetPath, "HEAD", remoteRef);
    const ahead = await commitsBetween(targetPath, remoteRef, "HEAD");

    if (behind > 0 && ahead > 0) {
      if (library.syncMode !== "two-way") {
        return {
          ...baseResult(library, targetPath, "diverged"),
          lastCommit: await currentCommit(targetPath),
          message: "The local and remote histories have diverged.",
        };
      }
      const rebased = await runGit(["rebase", remoteRef], targetPath).catch(
        (error) => error,
      );
      if (rebased instanceof Error) {
        await runGit(["rebase", "--abort"], targetPath).catch(() => null);
        return {
          ...baseResult(library, targetPath, "diverged"),
          lastCommit: await currentCommit(targetPath),
          message:
            "Local changes conflict with the remote and need manual resolution.",
        };
      }
    } else if (behind > 0) {
      await runGit(["merge", "--ff-only", remoteRef], targetPath);
    }

    const pushable = library.syncMode === "two-way";
    const shouldPush =
      pushable && (await commitsBetween(targetPath, remoteRef, "HEAD")) > 0;
    if (shouldPush) {
      await runGit(["push", "origin", `HEAD:${branch}`], targetPath);
    }

    return {
      ...baseResult(library, targetPath, behind > 0 ? "updated" : "up-to-date"),
      pulled: behind > 0,
      pushed: shouldPush,
      lastCommit: await currentCommit(targetPath),
      syncedAt: new Date().toISOString(),
    };
  } catch (error) {
    return failureResult(library, targetPath, error);
  }
}

/** Commits everything in the working tree and pushes it, for the explicit "sync skills" action. */
export async function pushGitLibraryChanges(
  library: GitLibraryConfig,
  targetPath: string,
): Promise<GitLibrarySyncResult> {
  try {
    if (!validateLibrary(library)) {
      return baseResult(library, targetPath, "not-configured");
    }
    if (!(await isGitRepository(targetPath))) {
      return baseResult(library, targetPath, "not-cloned");
    }

    const branch = cleanBranch(library.branch);
    const remoteRef = `origin/${branch}`;

    await ensureRemote(library, targetPath);
    await ensureIdentity(targetPath);

    const changes = await localChanges(targetPath);
    if (changes.length > 0) {
      await runGit(["add", "--all"], targetPath);
      await runGit(
        ["commit", "-m", `Skillful sync ${new Date().toISOString()}`],
        targetPath,
      );
    }

    await runGit(["fetch", "origin", branch], targetPath);
    if ((await commitsBetween(targetPath, "HEAD", remoteRef)) > 0) {
      const rebased = await runGit(["rebase", remoteRef], targetPath).catch(
        (error) => error,
      );
      if (rebased instanceof Error) {
        await runGit(["rebase", "--abort"], targetPath).catch(() => null);
        return {
          ...baseResult(library, targetPath, "diverged"),
          localChanges: await localChanges(targetPath),
          lastCommit: await currentCommit(targetPath),
          message:
            "Local changes conflict with the remote and need manual resolution.",
        };
      }
    }

    const pushed = (await commitsBetween(targetPath, remoteRef, "HEAD")) > 0;
    if (pushed) {
      await runGit(["push", "origin", `HEAD:${branch}`], targetPath);
    }

    return {
      ...baseResult(library, targetPath, "up-to-date"),
      pushed,
      lastCommit: await currentCommit(targetPath),
      syncedAt: new Date().toISOString(),
    };
  } catch (error) {
    return failureResult(library, targetPath, error);
  }
}

/** Throws away every local commit and edit so the clone matches the remote branch again. */
export async function discardGitLibraryChanges(
  library: GitLibraryConfig,
  targetPath: string,
): Promise<GitLibrarySyncResult> {
  try {
    if (!validateLibrary(library)) {
      return baseResult(library, targetPath, "not-configured");
    }
    if (!(await isGitRepository(targetPath))) {
      return baseResult(library, targetPath, "not-cloned");
    }

    const branch = cleanBranch(library.branch);

    await ensureRemote(library, targetPath);
    await runGit(["fetch", "origin", branch], targetPath);
    await runGit(["reset", "--hard", `origin/${branch}`], targetPath);
    await runGit(["clean", "-fd"], targetPath);

    return {
      ...baseResult(library, targetPath, "up-to-date"),
      pulled: true,
      lastCommit: await currentCommit(targetPath),
      syncedAt: new Date().toISOString(),
      message: "Local changes discarded.",
    };
  } catch (error) {
    return failureResult(library, targetPath, error);
  }
}
