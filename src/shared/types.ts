export type LibraryItemKind = "skill" | "agent";
export type AppLanguage = "system" | "en" | "nl";
export type EditorViewMode = "preview" | "edit";

/** Narrow, bundle-neutral stand-in for `NodeJS.Platform` so shared types don't leak Node ambient types into the webview bundle. */
export type Platform =
  | "aix"
  | "darwin"
  | "freebsd"
  | "linux"
  | "openbsd"
  | "sunos"
  | "win32"
  | "android"
  | "cygwin"
  | "netbsd"
  | "haiku";

export interface LibraryItemCollectionSummary {
  id: string;
  title: string;
}

export interface DeleteCollectionResult {
  collections: LibraryItemCollectionSummary[];
  libraryItems: LibraryItemSummary[];
}

export interface CreateLibraryItemInput {
  kind: LibraryItemKind;
  collectionId: string;
  name: string;
  description: string;
}

export interface MoveLibraryItemInput {
  id: string;
  collectionId: string;
}

export interface ImportCollectionFromPathInput {
  name: string;
  sourcePath: string;
}

export interface ImportCollectionFromArchiveInput {
  name: string;
  archivePath: string;
}

export interface ExportCollectionArchiveInput {
  collectionId: string;
  destinationFolder: string;
}

export interface ExportCollectionArchiveResult {
  archivePath: string;
}

export interface CollectionArchiveManifest {
  format: "skillful.collection";
  version: 1;
  collection: LibraryItemCollectionSummary;
  exportedAt: string;
  counts: {
    skills: number;
    agents: number;
    files: number;
  };
}

export interface LibraryItemSummary {
  id: string;
  kind: LibraryItemKind;
  collectionId: string;
  title: string;
  description?: string;
  rootPath: string;
  entryPath: string;
  supportingFiles: string[];
}

export interface LibraryItemFile {
  relativePath: string;
  absolutePath: string;
  content: string;
  isEntry: boolean;
}

export interface LibraryItemAdditionalFile {
  relativePath: string;
  absolutePath: string;
}

export interface LibraryItemDocument {
  item: LibraryItemSummary;
  files: LibraryItemFile[];
  additionalFiles: LibraryItemAdditionalFile[];
  /**
   * Non-fatal warnings produced by the operation that built this document.
   * Used for successful mutations that still need user attention, such as
   * metadata warnings after save or tool relink warnings after rename.
   */
  warnings?: string[];
}

export interface ToolConfig {
  id: string;
  name: string;
  installRoots: Record<LibraryItemKind, string[]>;
}

export type ToolInstallState = "not-installed" | "installed" | "unmanaged" | "broken" | "conflict";

export interface LibraryItemToolStatus {
  toolId: string;
  toolName: string;
  mapped: boolean;
  state: ToolInstallState;
  installRoots: string[];
  workingRoots: string[];
  problemRoots: string[];
  details?: string;
}

export interface LibraryItemToolMapping {
  itemId: string;
  toolIds: string[];
}

export interface AppConfig {
  scanRoots: string[];
  tools: ToolConfig[];
  toolMappings: LibraryItemToolMapping[];
  suppressSuccessNotifications: boolean;
  minimizeToTrayOnClose: boolean;
  language: AppLanguage;
  defaultEditorMode: EditorViewMode;
  onboardingTourCompleted: boolean;
}

export interface AppSettings {
  scanRoots: string[];
  defaultScanRoot: string;
  effectiveScanRoots: string[];
  homeDirectory: string;
  platform: Platform;
  tools: ToolConfig[];
  toolMappings: LibraryItemToolMapping[];
  suppressSuccessNotifications: boolean;
  minimizeToTrayOnClose: boolean;
  language: AppLanguage;
  defaultEditorMode: EditorViewMode;
  onboardingTourCompleted: boolean;
}
