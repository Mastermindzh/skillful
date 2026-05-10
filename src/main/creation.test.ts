import { describe, expect, it } from "vitest";
import { AppError } from "../shared/errors";
import { parseFrontmatter } from "../shared/frontmatter";
import { createItemContent, validateLibraryItemMetadata } from "./creation";

describe("validateLibraryItemMetadata", () => {
  it("trims the required name and description", () => {
    expect(validateLibraryItemMetadata("  Review PR  ", "  Review risky code changes.  ")).toEqual({
      title: "Review PR",
      description: "Review risky code changes.",
    });
  });

  it("rejects blank names", () => {
    expect(() => validateLibraryItemMetadata("   ", "Review risky code changes.")).toThrow(
      AppError
    );
    expect(() => validateLibraryItemMetadata("   ", "Review risky code changes.")).toThrow(
      /Item name is required\./
    );
  });

  it("rejects blank descriptions", () => {
    expect(() => validateLibraryItemMetadata("Review PR", "   ")).toThrow(AppError);
    expect(() => validateLibraryItemMetadata("Review PR", "   ")).toThrow(
      /Item description is required\./
    );
  });
});

describe("createItemContent", () => {
  it("writes required frontmatter and body content", () => {
    const content = createItemContent("Review PR", "Review risky code changes.");

    expect(parseFrontmatter(content)).toEqual({
      name: "Review PR",
      description: "Review risky code changes.",
    });
    expect(content).toContain("# Review PR");
    expect(content).toContain("\nReview risky code changes.\n");
  });

  it("escapes frontmatter values safely", () => {
    const content = createItemContent("Review: PR", 'Fetch issues: "and" PRs');

    expect(parseFrontmatter(content)).toEqual({
      name: "Review: PR",
      description: 'Fetch issues: "and" PRs',
    });
  });
});
