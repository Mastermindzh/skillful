import { AppError } from "./errors";
import { titleFromPathSegment } from "./library";
import { portablePathLeafName, safePortableRelativePath, toPortablePath } from "./paths";

export interface ImportCollectionFromGitHubInput {
  name: string;
  repo: string;
  ref?: string;
  path?: string;
}

export type GitHubImportDraft = Omit<ImportCollectionFromGitHubInput, "name"> & {
  name?: string;
};

const GITHUB_REPO_PATTERN = /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/;
const GITHUB_REF_PATTERN = /^[A-Za-z0-9._/-]{1,100}$/;
const MAX_GITHUB_PATH_LENGTH = 200;

function parseRepoFromGitHubUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.hostname !== "github.com") return value;
    const segments = url.pathname.split("/").filter(Boolean);
    if (segments.length < 2) return value;
    return `${segments[0]}/${segments[1]}`;
  } catch {
    return value;
  }
}

/** Accepts either `owner/repo` or a GitHub repository URL and returns canonical `owner/repo`. */
export function normalizeGitHubRepo(value: string) {
  const repo = parseRepoFromGitHubUrl(value.trim());
  if (!GITHUB_REPO_PATTERN.test(repo)) {
    throw new AppError(
      "invalid-path",
      "GitHub repository must use owner/repo format or a github.com repository URL."
    );
  }
  return repo;
}

/** Validates an optional Git ref using the same rules for deep-link imports. */
export function normalizeGitHubRef(value?: string | null) {
  const ref = value?.trim();
  if (!ref) return undefined;
  if (!GITHUB_REF_PATTERN.test(ref)) {
    throw new AppError(
      "invalid-path",
      "GitHub ref may contain only letters, numbers, ., _, -, and / (max 100 chars)."
    );
  }
  return ref;
}

/** Normalizes an optional repository subpath and rejects traversal or absolute paths. */
export function normalizeGitHubPath(value?: string | null) {
  const nextPath = value?.trim();
  if (!nextPath) return undefined;
  if (nextPath.length > MAX_GITHUB_PATH_LENGTH) {
    throw new AppError(
      "invalid-path",
      `GitHub path must be ${MAX_GITHUB_PATH_LENGTH} characters or fewer.`
    );
  }
  const normalized = safePortableRelativePath(toPortablePath(nextPath), "GitHub path");
  if (normalized.startsWith("./")) {
    return normalized.slice(2);
  }
  return normalized;
}

export function normalizeGitHubImportInput(input: ImportCollectionFromGitHubInput) {
  return {
    name: input.name.trim(),
    repo: normalizeGitHubRepo(input.repo),
    ref: normalizeGitHubRef(input.ref),
    path: normalizeGitHubPath(input.path),
  };
}

/** Builds the GitHub archive URL used for public one-way imports without a local git dependency. */
export function githubArchiveUrl(repo: string, ref?: string) {
  const encodedRef = ref
    ? ref
        .split("/")
        .map((segment) => encodeURIComponent(segment))
        .join("/")
    : undefined;
  return ref
    ? `https://github.com/${repo}/archive/${encodedRef}.zip`
    : `https://github.com/${repo}/archive/HEAD.zip`;
}

/** Derives a human-friendly default collection name from the requested repo/path. */
export function suggestedGitHubCollectionName(input: { repo: string; path?: string | null }) {
  let repoName = input.repo.split("/")[1];
  try {
    repoName = normalizeGitHubRepo(input.repo).split("/")[1];
  } catch {
    // Keep the best-effort split while the user is still typing an incomplete repo.
  }
  const basis = input.path?.trim() ? portablePathLeafName(input.path) : repoName;
  return basis ? titleFromPathSegment(basis) : "";
}
