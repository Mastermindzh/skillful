import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { AppError } from "../shared/errors";
import {
  githubArchiveUrl,
  type ImportCollectionFromGitHubInput,
  normalizeGitHubImportInput,
} from "../shared/githubImport";
import { ENTRY_FILE_BY_KIND } from "../shared/library";
import {
  joinPortablePath,
  portablePathBasename,
  portablePathDirname,
  portablePathLeafName,
  safePortableRelativePath,
} from "../shared/paths";
import type { LibraryItemKind } from "../shared/types";
import { COLLECTION_ARCHIVE_LIMITS } from "./archiveLimits";
import { importLibraryCollection } from "./collections";
import { ensureDirectory, validatePathSegment, writeFileExclusive } from "./fs";
import { unzipArchiveBytes } from "./zipArchives";

type ArchiveEntry = {
  relativePath: string;
  bytes: Uint8Array;
};

type ImportCandidate = {
  kind: LibraryItemKind;
  sourceRoot: string;
  destinationRelativeRoot: string;
  entries: ArchiveEntry[];
};

type FetchLike = typeof fetch;

function normalizeArchiveEntries(unzippedFiles: Record<string, Uint8Array>) {
  const entryNames = Object.keys(unzippedFiles);
  if (entryNames.length === 0) {
    throw new AppError("archive-format-unsupported", "GitHub archive was empty.");
  }

  const topLevelRoots = new Set(entryNames.map((entry) => entry.split(/[\\/]/)[0]).filter(Boolean));
  if (topLevelRoots.size !== 1) {
    throw new AppError(
      "archive-format-unsupported",
      "GitHub archive layout was unexpected and could not be imported."
    );
  }

  const [rootPrefix] = Array.from(topLevelRoots);
  const rootPrefixWithSeparator = `${rootPrefix}/`;
  const entries: ArchiveEntry[] = [];

  for (const [entryPath, bytes] of Object.entries(unzippedFiles)) {
    if (!entryPath.startsWith(rootPrefixWithSeparator)) continue;
    const relativePath = entryPath.slice(rootPrefixWithSeparator.length);
    if (!relativePath || relativePath.endsWith("/")) continue;
    entries.push({
      relativePath: safePortableRelativePath(relativePath, "GitHub archive entry"),
      bytes,
    });
  }

  return entries;
}

function relativePathWithinRoot(entryPath: string, sourceRoot: string) {
  if (!sourceRoot) return entryPath;
  if (!entryPath.startsWith(`${sourceRoot}/`)) {
    throw new AppError(
      "archive-path-unsafe",
      `GitHub archive entry escaped the selected root: ${entryPath}`
    );
  }
  return entryPath.slice(sourceRoot.length + 1);
}

function relativeRootWithinSelection(sourceRoot: string, selectionPath?: string) {
  if (!selectionPath) return sourceRoot;
  if (!sourceRoot) return "";
  if (sourceRoot === selectionPath) return "";
  if (!sourceRoot.startsWith(`${selectionPath}/`)) {
    throw new AppError(
      "archive-path-unsafe",
      `GitHub import root escaped the selected path: ${sourceRoot}`
    );
  }
  return sourceRoot.slice(selectionPath.length + 1);
}

function portablePathDepth(value: string) {
  if (!value) return 0;
  return value.split("/").filter(Boolean).length;
}

function isNestedPortableRoot(parentRoot: string, childRoot: string) {
  if (parentRoot === childRoot) return false;
  if (!parentRoot) return Boolean(childRoot);
  return childRoot.startsWith(`${parentRoot}/`);
}

function portableEntryIsInsideRoot(entryPath: string, root: string) {
  if (!root) return true;
  return entryPath === root || entryPath.startsWith(`${root}/`);
}

function normalizeDestinationRelativeRoot(
  kind: LibraryItemKind,
  sourceRoot: string,
  selection: { path?: string; repo: string }
) {
  const repoName = selection.repo.split("/")[1] || kind;
  let destinationRoot = relativeRootWithinSelection(sourceRoot, selection.path);

  if (!selection.path) {
    const kindPrefix = `${kind === "skill" ? "skills" : "agents"}/`;
    if (destinationRoot.startsWith(kindPrefix)) {
      destinationRoot = destinationRoot.slice(kindPrefix.length);
    }
  }

  const fallback = portablePathLeafName(sourceRoot || selection.path || repoName) || repoName;
  return safePortableRelativePath(destinationRoot || fallback, "GitHub import destination");
}

function detectImportCandidates(
  entries: ArchiveEntry[],
  selection: { path?: string; repo: string }
) {
  const candidateRoots = new Map<string, { kind: LibraryItemKind; sourceRoot: string }>();

  for (const entry of entries) {
    if (selection.path) {
      if (
        entry.relativePath !== selection.path &&
        !entry.relativePath.startsWith(`${selection.path}/`)
      ) {
        continue;
      }
    }

    const kind =
      portablePathBasename(entry.relativePath) === ENTRY_FILE_BY_KIND.skill
        ? "skill"
        : portablePathBasename(entry.relativePath) === ENTRY_FILE_BY_KIND.agent
          ? "agent"
          : null;
    if (!kind) continue;

    const sourceRoot =
      portablePathDirname(entry.relativePath) === "."
        ? ""
        : portablePathDirname(entry.relativePath);
    candidateRoots.set(`${kind}:${sourceRoot}`, { kind, sourceRoot });
  }

  if (candidateRoots.size === 0) {
    const target = selection.path ? `${selection.repo}/${selection.path}` : selection.repo;
    throw new AppError(
      "invalid-path",
      `No skills or agents with SKILL.md or AGENT.md were found in ${target}.`
    );
  }

  const topLevelCandidates = Array.from(candidateRoots.values())
    .sort((a, b) => portablePathDepth(a.sourceRoot) - portablePathDepth(b.sourceRoot))
    .filter((candidate, index, candidates) => {
      return !candidates
        .slice(0, index)
        .some(
          (prior) =>
            prior.kind === candidate.kind &&
            isNestedPortableRoot(prior.sourceRoot, candidate.sourceRoot)
        );
    });

  const namesByKind = new Map<string, string>();

  return topLevelCandidates.map((candidate) => {
    const destinationRelativeRoot = normalizeDestinationRelativeRoot(
      candidate.kind,
      candidate.sourceRoot,
      selection
    );
    const key = `${candidate.kind}:${destinationRelativeRoot.toLowerCase()}`;
    const existingRoot = namesByKind.get(key);
    if (existingRoot && existingRoot !== candidate.sourceRoot) {
      throw new AppError(
        "invalid-name",
        `GitHub import would create duplicate ${candidate.kind} folders at "${destinationRelativeRoot}".`
      );
    }
    namesByKind.set(key, candidate.sourceRoot);

    const nestedCandidateRoots = topLevelCandidates
      .filter((entry) => entry !== candidate)
      .map((entry) => entry.sourceRoot)
      .filter((sourceRoot) => isNestedPortableRoot(candidate.sourceRoot, sourceRoot));
    const candidateEntries = entries.filter((entry) => {
      if (!portableEntryIsInsideRoot(entry.relativePath, candidate.sourceRoot)) return false;
      return !nestedCandidateRoots.some((sourceRoot) =>
        portableEntryIsInsideRoot(entry.relativePath, sourceRoot)
      );
    });
    if (candidateEntries.length === 0) {
      throw new AppError(
        "archive-format-unsupported",
        `GitHub archive entry set for ${candidate.sourceRoot || "."} was unexpectedly empty.`
      );
    }

    return {
      ...candidate,
      destinationRelativeRoot,
      entries: candidateEntries,
    } satisfies ImportCandidate;
  });
}

async function writeStagedCandidates(stagingRoot: string, candidates: ImportCandidate[]) {
  for (const candidate of candidates) {
    const kindFolder = candidate.kind === "skill" ? "skills" : "agents";
    const destinationRoot = path.join(
      stagingRoot,
      ...joinPortablePath(kindFolder, candidate.destinationRelativeRoot).split("/")
    );
    await ensureDirectory(destinationRoot);

    for (const entry of candidate.entries) {
      const relativePath = relativePathWithinRoot(entry.relativePath, candidate.sourceRoot);
      const destinationPath = path.join(destinationRoot, relativePath);
      await ensureDirectory(path.dirname(destinationPath));
      await writeFileExclusive(
        destinationPath,
        entry.bytes,
        `GitHub import would overwrite staged file: ${relativePath}`
      );
    }
  }
}

async function downloadGitHubArchive(
  input: ReturnType<typeof normalizeGitHubImportInput>,
  fetchImpl: FetchLike
) {
  const archiveUrl = githubArchiveUrl(input.repo, input.ref);
  let response: Response;
  try {
    response = await fetchImpl(archiveUrl, {
      headers: {
        Accept: "application/zip",
        "User-Agent": "Skillful",
      },
      redirect: "follow",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new AppError("internal", `Failed to download the GitHub archive: ${message}`);
  }

  if (!response.ok) {
    throw new AppError(
      "internal",
      `Failed to download the GitHub archive (${response.status} ${response.statusText}).`
    );
  }

  const unzippedFiles = unzipArchiveBytes(
    new Uint8Array(await response.arrayBuffer()),
    COLLECTION_ARCHIVE_LIMITS,
    "GitHub archive"
  );
  return normalizeArchiveEntries(unzippedFiles);
}

/** Imports public GitHub-hosted skills and agents using source archives rather than local clones. */
export async function importLibraryCollectionFromGitHub(
  defaultRoot: string,
  input: ImportCollectionFromGitHubInput,
  fetchImpl: FetchLike = fetch
) {
  const normalizedInput = normalizeGitHubImportInput(input);
  const collectionName = validatePathSegment(normalizedInput.name, "Collection name");
  const archiveEntries = await downloadGitHubArchive(normalizedInput, fetchImpl);
  const candidates = detectImportCandidates(archiveEntries, normalizedInput);

  const stagingRoot = await mkdtemp(path.join(tmpdir(), "skillful-github-import-"));
  try {
    await writeStagedCandidates(stagingRoot, candidates);
    return await importLibraryCollection(defaultRoot, {
      name: collectionName,
      sourcePath: stagingRoot,
    });
  } finally {
    await rm(stagingRoot, { recursive: true, force: true }).catch(() => {});
  }
}
