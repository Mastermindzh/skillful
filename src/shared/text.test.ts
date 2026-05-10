import { describe, expect, it } from "vitest";
import { applyLineEnding, detectLineEnding, normalizeLineEndings } from "./text";

describe("line ending helpers", () => {
  it("normalizes CRLF to LF", () => {
    expect(normalizeLineEndings("one\r\ntwo\r\n")).toBe("one\ntwo\n");
  });

  it("detects CRLF when present", () => {
    expect(detectLineEnding("one\r\ntwo\n")).toBe("\r\n");
  });

  it("defaults to LF when no CRLF exists", () => {
    expect(detectLineEnding("one\ntwo\n")).toBe("\n");
  });

  it("applies CRLF to mixed line endings", () => {
    expect(applyLineEnding("one\ntwo\r\nthree\n", "\r\n")).toBe("one\r\ntwo\r\nthree\r\n");
  });
});
