import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppError } from "../shared/errors";
import { atomicWriteFile, safeResolveRelative, writeFileExclusive } from "./fs";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "skillful-fs-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("safeResolveRelative", () => {
  it("resolves legitimate nested paths inside the root", async () => {
    const nested = path.join(root, "sub");
    await mkdir(nested, { recursive: true });
    await writeFile(path.join(nested, "file.txt"), "ok");
    const resolved = await safeResolveRelative(root, "sub/file.txt");
    expect(resolved).toBe(path.join(root, "sub", "file.txt"));
  });

  it("rejects parent-directory traversal", async () => {
    await expect(safeResolveRelative(root, "../escape.txt")).rejects.toBeInstanceOf(AppError);
  });

  it("rejects absolute paths", async () => {
    await expect(safeResolveRelative(root, "/etc/passwd")).rejects.toBeInstanceOf(AppError);
  });

  it("rejects NUL bytes", async () => {
    await expect(safeResolveRelative(root, "file\u0000name")).rejects.toBeInstanceOf(AppError);
  });

  it("rejects empty relative paths", async () => {
    await expect(safeResolveRelative(root, "")).rejects.toBeInstanceOf(AppError);
  });

  it("rejects symlinks that escape the root", async () => {
    const outside = await mkdtemp(path.join(tmpdir(), "skillful-outside-"));
    try {
      await writeFile(path.join(outside, "secret.txt"), "secret");
      await symlink(path.join(outside, "secret.txt"), path.join(root, "link.txt"));
      await expect(safeResolveRelative(root, "link.txt")).rejects.toBeInstanceOf(AppError);
    } finally {
      await rm(outside, { recursive: true, force: true });
    }
  });
});

describe("atomicWriteFile", () => {
  it("writes the target file and removes the temp artifact", async () => {
    const target = path.join(root, "out.txt");
    await atomicWriteFile(target, "hello");
    const { readdir, readFile } = await import("node:fs/promises");
    expect(await readFile(target, "utf8")).toBe("hello");
    const entries = await readdir(root);
    expect(entries).toEqual(["out.txt"]);
  });

  it("creates missing parent directories", async () => {
    const target = path.join(root, "nested", "deep", "out.txt");
    await atomicWriteFile(target, "hi");
    const { readFile } = await import("node:fs/promises");
    expect(await readFile(target, "utf8")).toBe("hi");
  });
});

describe("writeFileExclusive", () => {
  it("writes when the target does not exist", async () => {
    const target = path.join(root, "new.txt");
    await writeFileExclusive(target, "data", "exists");
    const { readFile } = await import("node:fs/promises");
    expect(await readFile(target, "utf8")).toBe("data");
  });

  it("throws AppError with the provided message when the target exists", async () => {
    const target = path.join(root, "dupe.txt");
    await writeFile(target, "already");
    await expect(writeFileExclusive(target, "new", "It exists")).rejects.toMatchObject({
      code: "file-exists",
      message: "It exists",
    });
  });
});
