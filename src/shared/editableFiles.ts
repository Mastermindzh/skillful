/** Single source of truth for which file extensions the editor treats as editable text. */
export const EDITABLE_FILE_EXTENSIONS = [".md", ".mdc", ".mdx", ".txt"] as const;

const EDITABLE_FILE_EXTENSIONS_SET = new Set<string>(EDITABLE_FILE_EXTENSIONS);

export function isEditableFileExtension(extension: string) {
  return EDITABLE_FILE_EXTENSIONS_SET.has(extension.toLowerCase());
}
