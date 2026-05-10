import YAML from "yaml";
import { portablePathBasename } from "./paths";
import { normalizeLineEndings } from "./text";

const FRONTMATTER_BLOCK_PATTERN = /^---\n([\s\S]*?)\n---\n?/;

export type FrontmatterValidationIssueCode = "missing-name" | "missing-description";

export type FrontmatterValidationIssue = {
  code: FrontmatterValidationIssueCode;
  message: string;
};

export type FrontmatterValidationOptions = {
  /**
   * Entry files must declare metadata even when no frontmatter block exists.
   * Supporting markdown files only warn when they opt into frontmatter but leave it incomplete.
   */
  requireFrontmatter?: boolean;
};

function stringifyScalar(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return undefined;
}

/** Parses the YAML frontmatter block at the top of a file, tolerating parse errors. */
export function parseFrontmatter(content: string) {
  const normalized = normalizeLineEndings(content);
  const match = normalized.match(FRONTMATTER_BLOCK_PATTERN);
  if (!match) return {} as Record<string, string>;

  let parsed: unknown;
  try {
    parsed = YAML.parse(match[1]);
  } catch {
    return {} as Record<string, string>;
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {} as Record<string, string>;
  }

  const entries: Array<[string, string]> = [];
  for (const [key, rawValue] of Object.entries(parsed as Record<string, unknown>)) {
    const value = stringifyScalar(rawValue);
    if (value !== undefined) entries.push([key, value]);
  }
  return Object.fromEntries(entries);
}

/** Uses frontmatter description first, then falls back to the first plain paragraph. */
export function deriveDescription(content: string, frontmatter: Record<string, string>) {
  if (frontmatter.description) return frontmatter.description;
  const paragraph = normalizeLineEndings(content)
    .replace(FRONTMATTER_BLOCK_PATTERN, "")
    .split("\n\n")
    .map((block) => block.trim())
    .find((block) => block && !block.startsWith("#"));
  return paragraph;
}

/** Validates the required Skillful metadata keys in a markdown frontmatter block. */
export function validateFrontmatterMetadata(
  content: string,
  options: FrontmatterValidationOptions = {}
): FrontmatterValidationIssue[] {
  const normalized = normalizeLineEndings(content);
  const hasFrontmatter = FRONTMATTER_BLOCK_PATTERN.test(normalized);
  if (!hasFrontmatter && !options.requireFrontmatter) return [];

  const frontmatter = hasFrontmatter ? parseFrontmatter(content) : {};
  const issues: FrontmatterValidationIssue[] = [];
  if (!frontmatter.name?.trim()) {
    issues.push({ code: "missing-name", message: "Missing frontmatter name." });
  }
  if (!frontmatter.description?.trim()) {
    issues.push({
      code: "missing-description",
      message: "Missing frontmatter description.",
    });
  }
  return issues;
}

/**
 * Returns human-readable warnings when a markdown file's frontmatter is missing required
 * library item metadata. Entry files require frontmatter to exist; supporting markdown files
 * only warn when frontmatter is present but incomplete.
 */
export function frontmatterMetadataWarnings(content: string, requireFrontmatter = false): string[] {
  return validateFrontmatterMetadata(content, { requireFrontmatter }).map((issue) => issue.message);
}

export function frontmatterMetadataWarningsForFiles(
  entryPath: string,
  files: Array<{ relativePath: string; content: string; isEntry?: boolean }>
) {
  const entryFileName = portablePathBasename(entryPath);
  return files.flatMap((file) =>
    frontmatterMetadataWarnings(
      file.content,
      file.isEntry ?? portablePathBasename(file.relativePath) === entryFileName
    ).map((warning) => `${file.relativePath}: ${warning}`)
  );
}
