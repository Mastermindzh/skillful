export type PendingFileTarget = {
  relativePath: string;
  absolutePath: string;
  label: string;
  kind: "editable" | "additional";
};
