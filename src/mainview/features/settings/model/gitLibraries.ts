import { isAbsolutePath } from "../../../../shared/paths";
import type { GitLibraryConfig, GitLibrarySyncState } from "../../../../shared/types";
import type { TranslationKey } from "../../../i18n/messages";

export type GitLibraryIssue = {
  name?: TranslationKey;
  remoteUrl?: TranslationKey;
  branch?: TranslationKey;
  path?: TranslationKey;
  syncIntervalMinutes?: TranslationKey;
};

export type GitLibraryRow = GitLibraryConfig & {
  pendingRemoval?: boolean;
};

export type GitLibraryValidation = {
  libraries: GitLibraryConfig[];
  issueById: Record<string, GitLibraryIssue>;
  hasErrors: boolean;
};

/** Sync states that mean the user has work on disk that the remote does not know about. */
const UNSYNCED_STATES = new Set<GitLibrarySyncState>(["local-changes", "diverged"]);

export function gitLibraryHasLocalWork(state: GitLibrarySyncState) {
  return UNSYNCED_STATES.has(state);
}

export function createGitLibraryRow(): GitLibraryRow {
  return {
    id: crypto.randomUUID(),
    name: "",
    remoteUrl: "",
    branch: "main",
    path: "",
    syncMode: "pull",
    autoSync: true,
    syncIntervalMinutes: 60,
    readOnly: false,
  };
}

export function buildGitLibraryRows(libraries: GitLibraryConfig[]): GitLibraryRow[] {
  return libraries.map((library) => ({ ...library }));
}

/**
 * Mirrors the main-process `normalizeGitLibraries` checks so the user sees the problem inline
 * instead of as a thrown error after pressing save.
 */
export function validateGitLibraryRows(rows: GitLibraryRow[]): GitLibraryValidation {
  const issueById: Record<string, GitLibraryIssue> = {};
  const libraries: GitLibraryConfig[] = [];
  const seenPaths = new Map<string, string>();

  for (const row of rows) {
    if (row.pendingRemoval) continue;

    const library: GitLibraryConfig = {
      id: row.id,
      name: row.name.trim(),
      remoteUrl: row.remoteUrl.trim(),
      branch: row.branch.trim(),
      path: row.path.trim(),
      syncMode: row.syncMode,
      autoSync: row.autoSync,
      syncIntervalMinutes: Number(row.syncIntervalMinutes),
      readOnly: row.readOnly,
    };
    const issue: GitLibraryIssue = {};

    // A blank row is a row the user has not filled in yet, not an error.
    const empty = !library.name && !library.remoteUrl && !library.path;
    if (empty) continue;

    if (!library.name) issue.name = "settings.gitLibrary.error.nameRequired";
    if (!library.remoteUrl) {
      issue.remoteUrl = "settings.gitLibrary.error.remoteRequired";
    } else if (library.remoteUrl.includes("::")) {
      issue.remoteUrl = "settings.gitLibrary.error.remoteTransport";
    }

    if (!library.branch) {
      issue.branch = "settings.gitLibrary.error.branchRequired";
    } else if (/\s/.test(library.branch)) {
      issue.branch = "settings.gitLibrary.error.branchWhitespace";
    }

    if (library.path && !isAbsolutePath(library.path)) {
      issue.path = "settings.gitLibrary.error.pathAbsolute";
    } else if (library.path) {
      const duplicateOf = seenPaths.get(library.path);
      if (duplicateOf && duplicateOf !== library.id) {
        issue.path = "settings.gitLibrary.error.pathDuplicate";
      }
      seenPaths.set(library.path, library.id);
    }

    if (
      library.autoSync &&
      (!Number.isInteger(library.syncIntervalMinutes) || library.syncIntervalMinutes < 1)
    ) {
      issue.syncIntervalMinutes = "settings.gitLibrary.error.syncInterval";
    }

    if (Object.keys(issue).length > 0) issueById[library.id] = issue;
    libraries.push(library);
  }

  return {
    libraries,
    issueById,
    hasErrors: Object.keys(issueById).length > 0,
  };
}

export function sameGitLibraries(left: GitLibraryConfig[], right: GitLibraryConfig[]) {
  if (left.length !== right.length) return false;
  return left.every((library, index) => {
    const other = right[index];
    return (
      other !== undefined &&
      library.id === other.id &&
      library.name === other.name &&
      library.remoteUrl === other.remoteUrl &&
      library.branch === other.branch &&
      library.path === other.path &&
      library.syncMode === other.syncMode &&
      library.autoSync === other.autoSync &&
      library.syncIntervalMinutes === other.syncIntervalMinutes &&
      library.readOnly === other.readOnly
    );
  });
}
