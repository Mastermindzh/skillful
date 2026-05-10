export type LineEnding = "\n" | "\r\n";

export function normalizeLineEndings(content: string) {
  return content.replace(/\r\n/g, "\n");
}

/**
 * Detects the dominant line ending of a text file. CRLF wins when present so Windows-authored
 * files keep their style when we rewrite small pieces of metadata.
 */
export function detectLineEnding(content: string): LineEnding {
  return content.includes("\r\n") ? "\r\n" : "\n";
}

export function applyLineEnding(content: string, lineEnding: LineEnding) {
  return lineEnding === "\n" ? content : content.replace(/\r?\n/g, lineEnding);
}
