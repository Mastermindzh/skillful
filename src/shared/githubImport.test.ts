import { describe, expect, it } from "vitest";
import {
  githubArchiveUrl,
  normalizeGitHubPath,
  normalizeGitHubRef,
  normalizeGitHubRepo,
  suggestedGitHubCollectionName,
} from "./githubImport";

describe("normalizeGitHubRepo", () => {
  it("accepts owner/repo input", () => {
    expect(normalizeGitHubRepo("Mastermindzh/skillful")).toBe("Mastermindzh/skillful");
  });

  it("extracts owner/repo from a GitHub URL", () => {
    expect(normalizeGitHubRepo("https://github.com/Mastermindzh/skillful")).toBe(
      "Mastermindzh/skillful"
    );
  });

  it("rejects malformed repository input", () => {
    expect(() => normalizeGitHubRepo("not a repo")).toThrow(/GitHub repository/i);
  });
});

describe("normalizeGitHubRef", () => {
  it("returns undefined for an empty ref", () => {
    expect(normalizeGitHubRef("")).toBeUndefined();
  });

  it("accepts branch-like refs", () => {
    expect(normalizeGitHubRef("feature/import-flow")).toBe("feature/import-flow");
  });

  it("rejects invalid characters", () => {
    expect(() => normalizeGitHubRef("bad ref?")).toThrow(/GitHub ref/i);
  });
});

describe("normalizeGitHubPath", () => {
  it("normalizes backslashes to forward slashes", () => {
    expect(normalizeGitHubPath("skills\\review-pr")).toBe("skills/review-pr");
  });

  it("rejects traversal", () => {
    expect(() => normalizeGitHubPath("../escape")).toThrow(/GitHub path/i);
  });
});

describe("githubArchiveUrl", () => {
  it("uses HEAD.zip when no ref is provided", () => {
    expect(githubArchiveUrl("Mastermindzh/skillful")).toBe(
      "https://github.com/Mastermindzh/skillful/archive/HEAD.zip"
    );
  });

  it("uses the explicit ref when one is provided", () => {
    expect(githubArchiveUrl("Mastermindzh/skillful", "main")).toBe(
      "https://github.com/Mastermindzh/skillful/archive/main.zip"
    );
  });
});

describe("suggestedGitHubCollectionName", () => {
  it("uses the path leaf when a path is present", () => {
    expect(
      suggestedGitHubCollectionName({
        repo: "Mastermindzh/skillful-library",
        path: "skills/debug-checklist",
      })
    ).toBe("Debug Checklist");
  });

  it("falls back to the repo name", () => {
    expect(
      suggestedGitHubCollectionName({
        repo: "Mastermindzh/skillful-library",
      })
    ).toBe("Skillful Library");
  });
});
