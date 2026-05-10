import { strFromU8 } from "fflate";
import { AppError } from "../shared/errors";
import { slugFromText } from "../shared/library";
import { safePortableRelativePath } from "../shared/paths";
import { CollectionArchiveManifestSchema } from "../shared/schemas";
import type {
  CollectionArchiveManifest,
  LibraryItemCollectionSummary,
  LibraryItemKind,
} from "../shared/types";

export const ARCHIVE_FORMAT = "skillful.collection";
export const ARCHIVE_VERSION = 1;
export const MANIFEST_PATH = "skillful.collection.json";
export const COLLECTION_CONTENT_ROOT = "collection";
export const ARCHIVE_FOLDER_BY_KIND = {
  skill: "skills",
  agent: "agents",
} as const satisfies Record<LibraryItemKind, string>;

export const KIND_BY_LIBRARY_FOLDER: Record<string, LibraryItemKind> = {
  skills: "skill",
  agents: "agent",
};

export function archiveFileName(collection: LibraryItemCollectionSummary) {
  const slug = slugFromText(collection.title);
  return `${slug || collection.id}.skillful.zip`;
}

export function collectionArchivePath(kind: LibraryItemKind, relativePath: string) {
  return [
    COLLECTION_CONTENT_ROOT,
    ARCHIVE_FOLDER_BY_KIND[kind],
    safeArchivePath(relativePath),
  ].join("/");
}

export function safeArchivePath(relativePath: string) {
  return safePortableRelativePath(relativePath, "Archive path");
}

/**
 * The archive manifest is intentionally small but not decorative.
 * It lets imports reject random zip files before writing content, gives us a stable
 * format/version gate for future archive changes, and stores counts/name metadata
 * that can later power import previews without scanning every zip entry first.
 */
export function createCollectionArchiveManifest(input: {
  collection: LibraryItemCollectionSummary;
  skillCount: number;
  agentCount: number;
  fileCount: number;
}): CollectionArchiveManifest {
  return {
    format: ARCHIVE_FORMAT,
    version: ARCHIVE_VERSION,
    collection: input.collection,
    exportedAt: new Date().toISOString(),
    counts: {
      skills: input.skillCount,
      agents: input.agentCount,
      files: input.fileCount,
    },
  };
}

export function manifestFromArchive(bytes: Uint8Array): CollectionArchiveManifest {
  let manifest: unknown;
  try {
    manifest = JSON.parse(strFromU8(bytes));
  } catch {
    throw new AppError(
      "archive-manifest-missing",
      "Collection archive manifest could not be read."
    );
  }

  const parsed = CollectionArchiveManifestSchema.safeParse(manifest);
  if (!parsed.success) {
    throw new AppError("archive-format-unsupported", "Collection archive format is not supported.");
  }

  return parsed.data;
}
