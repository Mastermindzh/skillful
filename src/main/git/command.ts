import { spawn } from "node:child_process";
import { AppError } from "../../shared/errors";

const GIT_TIMEOUT_MS = 120_000;

export type GitCommandResult = {
  stdout: string;
  stderr: string;
};

export class GitCommandError extends Error {
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

/**
 * Forces ssh to run without any prompt. Skillful never reads, stores, or forwards ssh keys;
 * git shells out to the user's own `ssh`, which resolves agents, `~/.ssh/config`, and
 * `known_hosts` exactly as it would on the command line. `BatchMode=yes` only guarantees that a
 * missing passphrase or an unknown host fails fast instead of blocking a GUI process forever.
 * An existing `GIT_SSH_COMMAND` is respected so custom ssh wrappers keep working.
 */
function sshCommand() {
  const configured = process.env.GIT_SSH_COMMAND?.trim();
  if (configured) {
    return configured.includes("BatchMode") ? configured : `${configured} -o BatchMode=yes`;
  }
  return "ssh -o BatchMode=yes";
}

export function gitEnv() {
  return {
    ...process.env,
    GCM_INTERACTIVE: "never",
    GIT_TERMINAL_PROMPT: "0",
    GIT_SSH_COMMAND: sshCommand(),
    // Defense-in-depth: even if a remote URL slips past validation, restrict git to the
    // network/local transports Skillful uses so command-executing helpers (ext:: / fd::) cannot run.
    GIT_ALLOW_PROTOCOL: "https:ssh:file",
  };
}

export function runCommand(
  command: string,
  args: string[],
  cwd?: string,
  stdin?: string
): Promise<GitCommandResult> {
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

    if (stdin !== undefined) {
      child.stdin?.on("error", () => {});
      child.stdin?.end(stdin, "utf8");
    }

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

export async function runGit(args: string[], cwd?: string) {
  return runCommand("git", args, cwd);
}

export async function gitAvailable() {
  try {
    await runGit(["--version"]);
    return true;
  } catch {
    return false;
  }
}

export function sanitizedGitMessage(message: string, remoteUrl: string) {
  return message
    .split(remoteUrl)
    .join("[remote]")
    .replace(/https:\/\/[^/@\s]+@/g, "https://[credentials]@")
    .trim();
}

export function gitErrorMessage(error: unknown, remoteUrl: string) {
  const rawMessage =
    error instanceof GitCommandError
      ? `${error.stderr || error.stdout || error.message}`
      : error instanceof Error
        ? error.message
        : String(error);
  return sanitizedGitMessage(rawMessage, remoteUrl.trim());
}

export type GitFailureKind = "auth-failed" | "host-key-unverified" | "remote-unreachable" | "error";

/** Classifies a sanitized git/ssh failure message into the states the UI can act on. */
export function classifyGitFailure(message: string): GitFailureKind {
  const lower = message.toLowerCase();

  if (
    lower.includes("host key verification failed") ||
    lower.includes("no matching host key") ||
    lower.includes("authenticity of host") ||
    lower.includes("remote host identification has changed")
  ) {
    return "host-key-unverified";
  }

  if (
    lower.includes("permission denied") ||
    lower.includes("authentication failed") ||
    lower.includes("publickey") ||
    lower.includes("could not read username") ||
    lower.includes("could not read password") ||
    lower.includes("interactivity has been disabled") ||
    lower.includes("terminal prompts disabled")
  ) {
    return "auth-failed";
  }

  if (
    lower.includes("could not resolve hostname") ||
    lower.includes("could not read from remote repository") ||
    lower.includes("repository not found") ||
    lower.includes("failed to connect") ||
    lower.includes("unable to access")
  ) {
    return "remote-unreachable";
  }

  return "error";
}

/**
 * Rejects git remote URLs that use command-executing transport helpers. Git's
 * `transport::address` syntax (e.g. `ext::sh -c "..."` or `fd::`) runs arbitrary commands on
 * fetch/push, so any value containing the `::` remote-helper separator is refused. Normal
 * transports - `https://`, `ssh://`, scp-like `user@host:path`, and local/`file://` targets -
 * never contain `::` and remain allowed.
 */
export function validateRemoteUrlTransport(remoteUrl: string) {
  const value = remoteUrl.trim();
  if (!value) return;
  if (value.includes("::")) {
    throw new AppError("invalid-path", "Remote uses an unsupported git transport helper.");
  }
}

export function cleanBranch(value: string) {
  return value.trim();
}
