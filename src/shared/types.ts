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
  /** Set when the folder a new item would land in sits inside a git library clone. */
  sourceLibraryId?: string;
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
  /** Set when the item was discovered inside a git library clone. */
  sourceLibraryId?: string;
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

export interface GitBackupConfig {
  enabled: boolean;
  remoteUrl: string;
  branch: string;
  includeSettings: boolean;
  includeDefaultLibrary: boolean;
  autoBackup: boolean;
  autoBackupIntervalMinutes: number;
}

export type GitBackupState =
  | "disabled"
  | "not-configured"
  | "ready"
  | "missing-git"
  | "auth-failed"
  | "remote-unreachable"
  | "dirty"
  | "up-to-date"
  | "error";

export interface GitBackupStatus {
  state: GitBackupState;
  remoteUrl: string;
  branch: string;
  lastCommit?: string;
  lastBackupAt?: string;
  message?: string;
}

export interface GitBackupResult extends GitBackupStatus {
  changed: boolean;
  pushed: boolean;
}

export type GitBackupRestoreMode = "safe" | "replace";

export interface GitBackupRestoreResult extends GitBackupStatus {
  restored: boolean;
  localContentFound: boolean;
  restoredPaths: string[];
}

/**
 * `pull` fast-forwards from the remote and never pushes on its own; local edits are kept and
 * surfaced so the user can push them deliberately. `two-way` commits and pushes local edits as
 * part of every sync.
 */
export type GitLibrarySyncMode = "pull" | "two-way";

export interface GitLibraryConfig {
  id: string;
  name: string;
  remoteUrl: string;
  branch: string;
  /** Absolute clone destination, or empty to use the managed default location. */
  path: string;
  syncMode: GitLibrarySyncMode;
  autoSync: boolean;
  syncIntervalMinutes: number;
  /** Blocks Skillful's own writes into this clone so the remote stays the only author. */
  readOnly: boolean;
}

export type GitLibrarySyncState =
  | "not-cloned"
  | "up-to-date"
  | "updated"
  | "local-changes"
  | "diverged"
  | "missing-git"
  | "not-configured"
  | "auth-failed"
  | "host-key-unverified"
  | "remote-unreachable"
  | "error";

export interface GitLibraryChange {
  relativePath: string;
  status: string;
}

export interface GitLibrarySyncResult {
  libraryId: string;
  state: GitLibrarySyncState;
  path: string;
  remoteUrl: string;
  branch: string;
  cloned: boolean;
  pulled: boolean;
  pushed: boolean;
  localChanges: GitLibraryChange[];
  /** Set when `state` is `host-key-unverified` so the UI can offer to trust the host. */
  host?: string;
  lastCommit?: string;
  syncedAt?: string;
  message?: string;
}

export interface GitLibraryHostKey {
  host: string;
  keyType: string;
  fingerprint: string;
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
  gitBackup: GitBackupConfig;
  gitLibraries: GitLibraryConfig[];
  /** Written by the sync layer, not the settings form; keyed by git library id. */
  gitLibrarySyncedAt?: Record<string, string>;
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
  gitBackup: GitBackupConfig;
  gitLibraries: GitLibraryConfig[];
  /** Effective clone path per git library id, with the managed default already applied. */
  gitLibraryPaths: Record<string, string>;
  defaultGitLibraryRoot: string;
  /** ISO timestamp of the last successful sync, keyed by git library id. */
  gitLibrarySyncedAt: Record<string, string>;
}
