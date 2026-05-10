import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { strToU8, zipSync } from "fflate";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AppErrorCode } from "../shared/errors";
import {
  COLLECTION_CONTENT_ROOT,
  createCollectionArchiveManifest,
  MANIFEST_PATH,
} from "./collectionArchiveFormat";
import { importLibraryCollectionArchive, MAX_ARCHIVE_ENTRIES } from "./collectionArchives";

/**
 * These tests exercise the cap / shape checks inside `importLibraryCollectionArchive`.
 * They avoid the multi-hundred-megabyte caps (`MAX_ARCHIVE_COMPRESSED_BYTES`,
 * `MAX_ARCHIVE_UNCOMPRESSED_BYTES`, `MAX_ARCHIVE_ENTRY_BYTES`) to keep the test suite
 * fast; the cheaper cap (`MAX_ARCHIVE_ENTRIES = 10_000`) plus manifest and path-safety
 * branches are covered here.
 */

let tmpRoot: string;

function buildManifestBytes() {
  const manifest = createCollectionArchiveManifest({
    collection: { id: "fixture", title: "Fixture" },
    skillCount: 0,
    agentCount: 0,
    fileCount: 0,
  });
  return strToU8(JSON.stringify(manifest));
}

async function writeZipFixture(name: string, files: Record<string, Uint8Array>) {
  const archivePath = path.join(tmpRoot, name);
  const zipped = zipSync(files);
  await writeFile(archivePath, zipped);
  return archivePath;
}

async function expectAppError(promise: Promise<unknown>, code: AppErrorCode) {
  await expect(promise).rejects.toMatchObject({ name: "AppError", code });
}

beforeEach(async () => {
  tmpRoot = await mkdtemp(path.join(tmpdir(), "skillful-archives-"));
});

afterEach(async () => {
  await rm(tmpRoot, { recursive: true, force: true });
});

describe("importLibraryCollectionArchive", () => {
  it("rejects non-.zip archive paths", async () => {
    const archivePath = path.join(tmpRoot, "bogus.tar");
    await writeFile(archivePath, "not a zip");
    await expectAppError(
      importLibraryCollectionArchive(tmpRoot, { name: "Imported", archivePath }),
      "archive-format-unsupported"
    );
  });

  it("throws archive-too-many-entries when the archive exceeds MAX_ARCHIVE_ENTRIES", async () => {
    const files: Record<string, Uint8Array> = {
      [MANIFEST_PATH]: buildManifestBytes(),
    };
    const empty = new Uint8Array(0);
    const overLimit = MAX_ARCHIVE_ENTRIES + 1;
    for (let i = 0; i < overLimit; i += 1) {
      files[`${COLLECTION_CONTENT_ROOT}/skills/coll/item-${i}/skill.md`] = empty;
    }
    const archivePath = await writeZipFixture("many-entries.zip", files);
    await expectAppError(
      importLibraryCollectionArchive(tmpRoot, { name: "Imported", archivePath }),
      "archive-too-many-entries"
    );
  });

  it("throws archive-manifest-missing when the manifest entry is absent", async () => {
    const archivePath = await writeZipFixture("no-manifest.zip", {
      [`${COLLECTION_CONTENT_ROOT}/skills/coll/item/skill.md`]: strToU8("# body"),
    });
    await expectAppError(
      importLibraryCollectionArchive(tmpRoot, { name: "Imported", archivePath }),
      "archive-manifest-missing"
    );
  });

  it("throws archive-format-unsupported when the manifest contents are wrong shape", async () => {
    const archivePath = await writeZipFixture("bad-manifest.zip", {
      [MANIFEST_PATH]: strToU8(JSON.stringify({ not: "a manifest" })),
      [`${COLLECTION_CONTENT_ROOT}/skills/coll/item/skill.md`]: strToU8("# body"),
    });
    await expectAppError(
      importLibraryCollectionArchive(tmpRoot, { name: "Imported", archivePath }),
      "archive-format-unsupported"
    );
  });

  it("rejects archives containing absolute entry paths", async () => {
    const archivePath = await writeZipFixture("absolute.zip", {
      [MANIFEST_PATH]: buildManifestBytes(),
      "/etc/passwd": strToU8("nope"),
    });
    await expectAppError(
      importLibraryCollectionArchive(tmpRoot, { name: "Imported", archivePath }),
      "archive-path-unsafe"
    );
  });

  it("rejects archives containing parent-directory traversal", async () => {
    const archivePath = await writeZipFixture("traversal.zip", {
      [MANIFEST_PATH]: buildManifestBytes(),
      [`${COLLECTION_CONTENT_ROOT}/skills/../../../etc/passwd`]: strToU8("nope"),
    });
    await expectAppError(
      importLibraryCollectionArchive(tmpRoot, { name: "Imported", archivePath }),
      "archive-path-unsafe"
    );
  });

  it("rejects archives whose entries fall outside the collection content root", async () => {
    const archivePath = await writeZipFixture("stray.zip", {
      [MANIFEST_PATH]: buildManifestBytes(),
      "elsewhere/skill.md": strToU8("nope"),
    });
    await expectAppError(
      importLibraryCollectionArchive(tmpRoot, { name: "Imported", archivePath }),
      "archive-path-unsafe"
    );
  });

  it("rejects archives whose entries collide on case-insensitive filesystems", async () => {
    const archivePath = await writeZipFixture("case-collide.zip", {
      [MANIFEST_PATH]: buildManifestBytes(),
      [`${COLLECTION_CONTENT_ROOT}/skills/coll/item/Skill.md`]: strToU8("# upper"),
      [`${COLLECTION_CONTENT_ROOT}/skills/coll/item/skill.md`]: strToU8("# lower"),
    });
    await expectAppError(
      importLibraryCollectionArchive(tmpRoot, { name: "Imported", archivePath }),
      "archive-path-unsafe"
    );
  });

  it("imports a well-formed archive into the default root", async () => {
    const archivePath = await writeZipFixture("good.zip", {
      [MANIFEST_PATH]: buildManifestBytes(),
      [`${COLLECTION_CONTENT_ROOT}/skills/coll/item/skill.md`]: strToU8("# hi"),
    });
    await importLibraryCollectionArchive(tmpRoot, { name: "Imported", archivePath });

    const skillsRoot = path.join(tmpRoot, "skills", "Imported");
    const skillFile = path.join(skillsRoot, "coll", "item", "skill.md");
    const stats = await stat(skillFile);
    expect(stats.isFile()).toBe(true);
  });
});
