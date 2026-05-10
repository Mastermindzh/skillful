export type ImportMode = "archive" | "folder" | "github";

export type ImportCollectionFieldErrors = {
  sourcePath?: string;
  repo?: string;
  ref?: string;
  path?: string;
  name?: string;
  form?: string;
};
