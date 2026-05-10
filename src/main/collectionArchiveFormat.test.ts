import { strToU8 } from "fflate";
import { describe, expect, it } from "vitest";
import { AppError } from "../shared/errors";
import {
  ARCHIVE_FORMAT,
  ARCHIVE_VERSION,
  archiveFileName,
  collectionArchivePath,
  createCollectionArchiveManifest,
  manifestFromArchive,
  safeArchivePath,
} from "./collectionArchiveFormat";

describe("archiveFileName", () => {
  it("uses a slugified title when available", () => {
    expect(archiveFileName({ id: "abc", title: "My Cool Pack" })).toBe("my-cool-pack.skillful.zip");
  });

  it("falls back to id when slug is empty", () => {
    expect(archiveFileName({ id: "abc123", title: "!!!" })).toBe("abc123.skillful.zip");
  });
});

describe("safeArchivePath", () => {
  it("normalises backslashes to forward slashes", () => {
    expect(safeArchivePath("folder\\nested\\file.md")).toBe("folder/nested/file.md");
  });

  it("rejects parent traversal", () => {
    expect(() => safeArchivePath("../escape")).toThrow();
  });

  it("rejects absolute paths", () => {
    expect(() => safeArchivePath("/etc/passwd")).toThrow();
  });

  it("rejects NUL bytes", () => {
    expect(() => safeArchivePath("bad\u0000")).toThrow();
  });
});

describe("collectionArchivePath", () => {
  it("places skill entries under collection/skills/", () => {
    expect(collectionArchivePath("skill", "pack/SKILL.md")).toBe("collection/skills/pack/SKILL.md");
  });

  it("places agent entries under collection/agents/", () => {
    expect(collectionArchivePath("agent", "pack/AGENT.md")).toBe("collection/agents/pack/AGENT.md");
  });
});

describe("createCollectionArchiveManifest", () => {
  it("includes the expected format, version, and counts", () => {
    const manifest = createCollectionArchiveManifest({
      collection: { id: "abc", title: "Pack" },
      skillCount: 2,
      agentCount: 1,
      fileCount: 7,
    });
    expect(manifest.format).toBe(ARCHIVE_FORMAT);
    expect(manifest.version).toBe(ARCHIVE_VERSION);
    expect(manifest.counts).toEqual({ skills: 2, agents: 1, files: 7 });
    expect(manifest.collection).toEqual({ id: "abc", title: "Pack" });
    expect(typeof manifest.exportedAt).toBe("string");
  });
});

describe("manifestFromArchive", () => {
  const validManifest = {
    format: ARCHIVE_FORMAT,
    version: ARCHIVE_VERSION,
    collection: { id: "abc", title: "Pack" },
    exportedAt: new Date().toISOString(),
    counts: { skills: 1, agents: 0, files: 2 },
  };

  it("accepts a valid manifest", () => {
    const parsed = manifestFromArchive(strToU8(JSON.stringify(validManifest)));
    expect(parsed.collection.id).toBe("abc");
  });

  it("throws archive-manifest-missing on invalid JSON", () => {
    expect(() => manifestFromArchive(strToU8("not json"))).toThrow(AppError);
    try {
      manifestFromArchive(strToU8("not json"));
    } catch (error) {
      expect((error as AppError).code).toBe("archive-manifest-missing");
    }
  });

  it("throws archive-format-unsupported on wrong format", () => {
    try {
      manifestFromArchive(strToU8(JSON.stringify({ ...validManifest, format: "other" })));
      throw new Error("expected throw");
    } catch (error) {
      expect((error as AppError).code).toBe("archive-format-unsupported");
    }
  });

  it("throws archive-format-unsupported on wrong version", () => {
    try {
      manifestFromArchive(strToU8(JSON.stringify({ ...validManifest, version: 999 })));
      throw new Error("expected throw");
    } catch (error) {
      expect((error as AppError).code).toBe("archive-format-unsupported");
    }
  });

  it("throws archive-format-unsupported on missing fields", () => {
    try {
      manifestFromArchive(strToU8(JSON.stringify({ format: ARCHIVE_FORMAT })));
      throw new Error("expected throw");
    } catch (error) {
      expect((error as AppError).code).toBe("archive-format-unsupported");
    }
  });
});
