import { AppError } from "./errors";
import {
  type GitHubImportDraft,
  normalizeGitHubPath,
  normalizeGitHubRef,
  normalizeGitHubRepo,
} from "./githubImport";

function normalizeSuggestedCollection(value?: string | null) {
  const trimmed = value
    ?.split("")
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code >= 0x20 && code !== 0x7f;
    })
    .join("")
    .trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, 80);
}

export function parseSkillfulImportDeepLink(urlString: string): GitHubImportDraft {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    throw new AppError("invalid-path", "Deep link URL is malformed.");
  }

  if (url.protocol !== "skillful:") {
    throw new AppError("invalid-path", "Deep link must use the skillful:// protocol.");
  }
  if (url.hostname !== "import") {
    throw new AppError("invalid-path", "Deep link action is not supported.");
  }

  const repo = normalizeGitHubRepo(url.searchParams.get("repo") ?? "");
  const ref = normalizeGitHubRef(url.searchParams.get("ref"));
  const path = normalizeGitHubPath(url.searchParams.get("path"));
  const name = normalizeSuggestedCollection(url.searchParams.get("collection"));

  return {
    repo,
    ...(ref ? { ref } : {}),
    ...(path ? { path } : {}),
    ...(name ? { name } : {}),
  };
}

export function findSkillfulDeepLink(argv: string[]) {
  return argv.find((entry) => entry.startsWith("skillful://")) ?? null;
}
