/**
 * Compact display form for a git remote, used where the full URL is too long to be useful.
 *
 * Collapses the transport, credentials, port, and `.git` suffix so what remains is the part a
 * user actually recognises: `host:owner/repo`. Anything that cannot be parsed falls back to the
 * original string rather than guessing.
 */
export function formatGitRemoteLabel(
  remoteUrl: string,
  branch?: string,
): string {
  const value = remoteUrl.trim();
  if (!value) return "";

  const parsed = parseRemote(value);
  const label = parsed ?? value;
  const cleanBranch = branch?.trim();
  return cleanBranch ? `${label}@${cleanBranch}` : label;
}

function stripGitSuffix(repoPath: string) {
  return repoPath
    .replace(/\.git$/i, "")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
}

/** Parses scp-style `[user@]host:path` remotes; a `/` right after the colon means it is not scp-style. */
export function parseScpRemote(
  value: string,
): { host: string; path: string } | null {
  const match = value.match(/^(?:[^@/\s]+@)?([^:/\s]+):(?!\/)(.*)$/);
  if (!match) return null;
  const [, host = "", repoPath = ""] = match;
  return { host, path: repoPath };
}

function parseRemote(value: string): string | null {
  const scpLike = parseScpRemote(value);
  if (scpLike) {
    const repo = stripGitSuffix(scpLike.path);
    return scpLike.host && repo ? `${scpLike.host}:${repo}` : null;
  }

  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      const repo = stripGitSuffix(url.pathname);
      return url.hostname && repo ? `${url.hostname}:${repo}` : null;
    } catch {
      return null;
    }
  }

  return null;
}
