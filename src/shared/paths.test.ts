import { describe, expect, it } from "vitest";
import { isAbsolutePath, isAbsolutePathOnPlatform, isHomePath } from "./paths";

describe("isHomePath", () => {
  it("accepts ~ with either separator", () => {
    expect(isHomePath("~")).toBe(true);
    expect(isHomePath("~/skills")).toBe(true);
    expect(isHomePath("~\\skills")).toBe(true);
  });

  it("rejects other users' homes and literal tildes", () => {
    expect(isHomePath("~other/skills")).toBe(false);
    expect(isHomePath("/srv/~/skills")).toBe(false);
  });
});

describe("isAbsolutePath", () => {
  it("accepts POSIX, drive-letter, and UNC paths", () => {
    expect(isAbsolutePath("/srv/skills")).toBe(true);
    expect(isAbsolutePath("C:\\skills")).toBe(true);
    expect(isAbsolutePath("C:/skills")).toBe(true);
    expect(isAbsolutePath("\\\\server\\share")).toBe(true);
  });

  it("rejects relative paths", () => {
    expect(isAbsolutePath("skills")).toBe(false);
    expect(isAbsolutePath("C:skills")).toBe(false);
  });
});

describe("isAbsolutePathOnPlatform", () => {
  it("only accepts drive-letter and UNC paths on Windows", () => {
    expect(isAbsolutePathOnPlatform("C:\\skills", "win32")).toBe(true);
    expect(isAbsolutePathOnPlatform("\\\\server\\share", "win32")).toBe(true);
    expect(isAbsolutePathOnPlatform("//server/share", "win32")).toBe(true);
    expect(isAbsolutePathOnPlatform("/srv/skills", "win32")).toBe(false);
  });

  it("only accepts slash-rooted paths elsewhere", () => {
    expect(isAbsolutePathOnPlatform("/srv/skills", "linux")).toBe(true);
    expect(isAbsolutePathOnPlatform("/Users/me", "darwin")).toBe(true);
    expect(isAbsolutePathOnPlatform("C:\\skills", "linux")).toBe(false);
    expect(isAbsolutePathOnPlatform("\\\\server\\share", "linux")).toBe(false);
  });

  it("accepts home paths on every platform", () => {
    expect(isAbsolutePathOnPlatform("~/skills", "linux")).toBe(true);
    expect(isAbsolutePathOnPlatform("~/skills", "win32")).toBe(true);
    expect(isAbsolutePath("~/skills")).toBe(true);
  });
});
