import { describe, expect, it } from "vitest";
import {
  deriveDescription,
  frontmatterMetadataWarnings,
  frontmatterMetadataWarningsForFiles,
  parseFrontmatter,
  validateFrontmatterMetadata,
} from "./frontmatter";

describe("parseFrontmatter", () => {
  it("returns empty object when no frontmatter block is present", () => {
    expect(parseFrontmatter("# Just a heading\n\nSome body text.")).toEqual({});
  });

  it("returns empty object for empty input", () => {
    expect(parseFrontmatter("")).toEqual({});
  });

  it("parses a well-formed YAML frontmatter block", () => {
    const input = ["---", "name: My Skill", "description: Does things", "---", "", "# Body"].join(
      "\n"
    );
    expect(parseFrontmatter(input)).toEqual({
      name: "My Skill",
      description: "Does things",
    });
  });

  it("preserves colons inside quoted values", () => {
    const input = ["---", 'description: "Fetch issues: PRs too"', "---", ""].join("\n");
    expect(parseFrontmatter(input)).toEqual({
      description: "Fetch issues: PRs too",
    });
  });

  it("tolerates CRLF line endings", () => {
    const input = ["---", "name: CRLF Skill", "description: Windows-authored", "---", ""].join(
      "\r\n"
    );
    expect(parseFrontmatter(input)).toEqual({
      name: "CRLF Skill",
      description: "Windows-authored",
    });
  });

  it("returns empty object when YAML is malformed", () => {
    const input = ["---", "name: [unterminated", "---", ""].join("\n");
    expect(parseFrontmatter(input)).toEqual({});
  });

  it("returns empty object when frontmatter is a YAML list", () => {
    const input = ["---", "- one", "- two", "---", ""].join("\n");
    expect(parseFrontmatter(input)).toEqual({});
  });

  it("coerces numeric and boolean scalars to strings", () => {
    const input = ["---", "version: 2", "draft: true", "---", ""].join("\n");
    expect(parseFrontmatter(input)).toEqual({
      version: "2",
      draft: "true",
    });
  });

  it("drops non-scalar values", () => {
    const input = [
      "---",
      "name: Skill",
      "tags:",
      "  - a",
      "  - b",
      "meta:",
      "  author: me",
      "note: null",
      "---",
      "",
    ].join("\n");
    expect(parseFrontmatter(input)).toEqual({ name: "Skill" });
  });

  it("requires the frontmatter to start at offset 0", () => {
    const input = ["", "---", "name: Skill", "---", ""].join("\n");
    expect(parseFrontmatter(input)).toEqual({});
  });
});

describe("deriveDescription", () => {
  it("prefers frontmatter description when present", () => {
    expect(deriveDescription("# Heading\n\nBody paragraph.", { description: "FM desc" })).toBe(
      "FM desc"
    );
  });

  it("returns the first non-heading paragraph when no frontmatter description exists", () => {
    const content = [
      "---",
      "name: Skill",
      "---",
      "",
      "# Heading",
      "",
      "First paragraph of prose.",
      "",
      "Second paragraph.",
    ].join("\n");
    expect(deriveDescription(content, {})).toBe("First paragraph of prose.");
  });

  it("normalizes CRLF before searching for paragraphs", () => {
    const content = ["---", "name: Skill", "---", "", "First paragraph."].join("\r\n");
    expect(deriveDescription(content, {})).toBe("First paragraph.");
  });

  it("returns undefined when only headings are present", () => {
    expect(deriveDescription("# Only heading\n\n## Subheading", {})).toBeUndefined();
  });
});

describe("frontmatterMetadataWarnings", () => {
  it("returns no warnings for supporting files without frontmatter", () => {
    expect(frontmatterMetadataWarnings("Plain prose.\n\nStill prose.")).toEqual([]);
  });

  it("warns when a frontmatter block is present but required keys are missing", () => {
    const content = ["---", "name: Skill", "---", "", "# Heading"].join("\n");
    expect(frontmatterMetadataWarnings(content)).toEqual(["Missing frontmatter description."]);
  });

  it("warns for both missing keys on entry files without frontmatter", () => {
    expect(frontmatterMetadataWarnings("# Heading\n\nBody", true)).toEqual([
      "Missing frontmatter name.",
      "Missing frontmatter description.",
    ]);
  });

  it("returns no warnings when both required keys are present", () => {
    const content = ["---", "name: Skill", "description: Desc", "---", "", "# Heading"].join("\n");
    expect(frontmatterMetadataWarnings(content, true)).toEqual([]);
  });

  it("formats warnings for saved files and handles Windows entry paths", () => {
    const warnings = frontmatterMetadataWarningsForFiles(
      "C:\\Users\\me\\skillful\\skills\\Collection\\review-pr\\SKILL.md",
      [
        {
          relativePath: "SKILL.md",
          content: ["---", "name: Review PR", "---", "", "# Review PR"].join("\n"),
        },
        {
          relativePath: "notes.md",
          content: "# Notes",
        },
      ]
    );

    expect(warnings).toEqual(["SKILL.md: Missing frontmatter description."]);
  });

  it("prefers explicit entry markers over basename matching", () => {
    const warnings = frontmatterMetadataWarningsForFiles("/library/item/SKILL.md", [
      {
        relativePath: "docs/SKILL.md",
        content: "# Supporting file with matching basename",
        isEntry: false,
      },
      {
        relativePath: "ENTRY.md",
        content: "---\nname: Real entry\n---\n\n# Real entry",
        isEntry: true,
      },
    ]);

    expect(warnings).toEqual(["ENTRY.md: Missing frontmatter description."]);
  });
});

describe("validateFrontmatterMetadata", () => {
  it("returns structured issues for an entry file without frontmatter", () => {
    expect(validateFrontmatterMetadata("# Heading\n\nBody", { requireFrontmatter: true })).toEqual([
      { code: "missing-name", message: "Missing frontmatter name." },
      { code: "missing-description", message: "Missing frontmatter description." },
    ]);
  });

  it("ignores supporting files without frontmatter", () => {
    expect(validateFrontmatterMetadata("# Notes")).toEqual([]);
  });

  it("validates incomplete frontmatter on supporting files", () => {
    const content = ["---", "name: Notes", "---", "", "# Notes"].join("\n");
    expect(validateFrontmatterMetadata(content)).toEqual([
      { code: "missing-description", message: "Missing frontmatter description." },
    ]);
  });
});
