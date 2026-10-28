import { appendFile, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { AppError } from "../../shared/errors";
import type { GitLibraryHostKey } from "../../shared/types";
import { ensureDirectory } from "../fs";
import { runCommand } from "./command";

const HOST_PATTERN = /^[a-z0-9.-]+$/i;

function knownHostsPath() {
  return path.join(homedir(), ".ssh", "known_hosts");
}

function assertScannableHost(host: string) {
  // ssh-keyscan is spawned without a shell, but keeping the host to a plain DNS label also
  // stops option-looking values (`-oProxyCommand=...`) from ever reaching the argument list.
  if (!HOST_PATTERN.test(host) || host.startsWith("-")) {
    throw new AppError("invalid-name", `Not a valid host name: ${host}`);
  }
}

type ScannedHostKey = {
  /** The exact `known_hosts` line the fingerprint was computed from. */
  line: string;
  key: GitLibraryHostKey;
};

/**
 * Fetches a host key and fingerprints that exact line.
 *
 * Returning the raw line alongside the fingerprint is what lets the trust step write the same
 * bytes it verified; fingerprinting one scan and appending another would leave a gap in the very
 * check this module exists to perform.
 */
async function scanHostKey(host: string): Promise<ScannedHostKey | null> {
  const value = host.trim();
  assertScannableHost(value);

  const scanned = await runCommand("ssh-keyscan", ["-T", "10", "-t", "ed25519,ecdsa,rsa", value])
    .then((result) => result.stdout)
    .catch(() => "");

  const line = scanned
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .find((entry) => entry && !entry.startsWith("#"));
  if (!line) return null;

  const fingerprint = await runCommand("ssh-keygen", ["-lf", "-"], undefined, line)
    .then((result) => result.stdout.trim())
    .catch(() => "");

  const [, hash = "", , type = ""] = fingerprint.split(/\s+/);
  // Without a fingerprint there is nothing to compare later, and two empty strings would match.
  if (!hash) return null;

  return {
    line,
    key: {
      host: value,
      keyType: type.replace(/[()]/g, "") || line.split(/\s+/)[1] || "unknown",
      fingerprint: hash,
    },
  };
}

/**
 * Fetches the host key ssh would be asked to trust, together with its fingerprint.
 *
 * This is the data an interactive `ssh` session prints before asking "are you sure you want to
 * continue connecting?". Skillful shows it to the user and only writes to `known_hosts` after
 * they confirm, so trust-on-first-use stays an explicit decision instead of a silent one.
 */
export async function scanGitLibraryHostKey(host: string): Promise<GitLibraryHostKey | null> {
  return (await scanHostKey(host))?.key ?? null;
}

async function appendKnownHost(line: string) {
  const knownHosts = knownHostsPath();
  await ensureDirectory(path.dirname(knownHosts));
  const existing = await readFile(knownHosts, "utf8").catch(() => "");
  const alreadyTrusted = existing.split(/\r?\n/).some((entry) => entry.trim() === line);
  if (alreadyTrusted) return;

  const prefix = existing && !existing.endsWith("\n") ? "\n" : "";
  await appendFile(knownHosts, `${prefix}${line}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
}

/**
 * Appends a previously shown host key to the user's `known_hosts`.
 *
 * The host is re-scanned and matched against the fingerprint the user approved, so a host that
 * changes its key between the prompt and the confirmation is rejected rather than trusted. Only
 * the single key that was verified is written, which is what interactive ssh does too.
 */
export async function trustGitLibraryHost(approved: GitLibraryHostKey) {
  const scanned = await scanHostKey(approved.host);
  if (!scanned) {
    throw new AppError("internal", `Could not read the host key for ${approved.host}.`);
  }
  if (scanned.key.fingerprint !== approved.fingerprint) {
    throw new AppError(
      "internal",
      `The host key for ${approved.host} changed since it was shown. Nothing was trusted.`
    );
  }

  await appendKnownHost(scanned.line);
}
