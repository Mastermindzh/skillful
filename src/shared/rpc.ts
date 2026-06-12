import type { GitHubImportDraft, ImportCollectionFromGitHubInput } from "./githubImport";
import type {
  AppConfig,
  AppSettings,
  CreateLibraryItemInput,
  DeleteCollectionResult,
  ExportCollectionArchiveInput,
  ExportCollectionArchiveResult,
  GitBackupConfig,
  GitBackupRestoreMode,
  GitBackupResult,
  ImportCollectionFromArchiveInput,
  ImportCollectionFromPathInput,
  LibraryItemCollectionSummary,
  LibraryItemDocument,
  LibraryItemSummary,
  LibraryItemToolStatus,
  MoveLibraryItemInput,
} from "./types";
import type { AppUpdateState, UpdateStatusEntry } from "./updates";

type EmptyRPC = Record<string, never>;

export type AppRPC = {
  bun: {
    requests: {
      getConfig: {
        params: undefined;
        response: AppSettings;
      };
      saveConfig: {
        params: AppConfig;
        response: AppSettings;
      };
      setOnboardingTourCompleted: {
        params: { completed: boolean };
        response: AppSettings;
      };
      listLibraryItems: {
        params: undefined;
        response: LibraryItemSummary[];
      };
      listCollections: {
        params: undefined;
        response: LibraryItemCollectionSummary[];
      };
      createCollection: {
        params: { name: string };
        response: LibraryItemCollectionSummary;
      };
      pickImportFolder: {
        params: undefined;
        response: string | null;
      };
      pickImportArchive: {
        params: undefined;
        response: string | null;
      };
      pickCollectionExportFolder: {
        params: undefined;
        response: string | null;
      };
      pickToolInstallFolder: {
        params: undefined;
        response: string | null;
      };
      initializeGitBackup: {
        params: { gitBackup: GitBackupConfig };
        response: GitBackupResult;
      };
      runGitBackup: {
        params: undefined;
        response: GitBackupResult;
      };
      restoreGitBackup: {
        params: { gitBackup: GitBackupConfig; mode: GitBackupRestoreMode };
        response: AppSettings;
      };
      importCollection: {
        params: ImportCollectionFromPathInput;
        response: LibraryItemCollectionSummary;
      };
      importCollectionArchive: {
        params: ImportCollectionFromArchiveInput;
        response: LibraryItemCollectionSummary;
      };
      importCollectionFromGitHub: {
        params: ImportCollectionFromGitHubInput;
        response: LibraryItemCollectionSummary;
      };
      exportCollectionArchive: {
        params: ExportCollectionArchiveInput;
        response: ExportCollectionArchiveResult;
      };
      renameCollection: {
        params: { id: string; name: string };
        response: LibraryItemCollectionSummary;
      };
      createLibraryItem: {
        params: CreateLibraryItemInput;
        response: LibraryItemSummary;
      };
      renameLibraryItem: {
        params: { id: string; name: string };
        response: LibraryItemDocument;
      };
      moveLibraryItem: {
        params: MoveLibraryItemInput;
        response: LibraryItemDocument;
      };
      createLibraryItemFile: {
        params: { id: string; name: string };
        response: LibraryItemDocument;
      };
      renameLibraryItemFile: {
        params: { id: string; relativePath: string; name: string };
        response: LibraryItemDocument;
      };
      renameAdditionalLibraryItemFile: {
        params: { id: string; relativePath: string; name: string };
        response: LibraryItemDocument;
      };
      uploadLibraryItemFiles: {
        params: {
          id: string;
          files: Array<{ name: string; contentBase64: string }>;
        };
        response: LibraryItemDocument;
      };
      deleteAdditionalLibraryItemFile: {
        params: { id: string; relativePath: string };
        response: LibraryItemDocument;
      };
      deleteLibraryItemFile: {
        params: { id: string; relativePath: string };
        response: LibraryItemDocument;
      };
      deleteLibraryItem: {
        params: { id: string };
        response: LibraryItemSummary[];
      };
      openPath: {
        params: { path: string };
        response: undefined;
      };
      revealPath: {
        params: { path: string };
        response: undefined;
      };
      createDirectory: {
        params: { path: string };
        response: undefined;
      };
      deleteCollection: {
        params: { id: string };
        response: DeleteCollectionResult;
      };
      readLibraryItem: {
        params: { id: string };
        response: LibraryItemDocument;
      };
      saveLibraryItem: {
        params: { id: string; relativePath: string; content: string };
        response: LibraryItemDocument;
      };
      saveLibraryItemFiles: {
        params: {
          id: string;
          files: Array<{ relativePath: string; content: string }>;
        };
        response: LibraryItemDocument;
      };
      refreshLibraryItems: {
        params: undefined;
        response: LibraryItemSummary[];
      };
      getLibraryItemToolStatuses: {
        params: { itemId: string };
        response: LibraryItemToolStatus[];
      };
      installLibraryItemTool: {
        params: { itemId: string; toolId: string };
        response: AppSettings;
      };
      removeLibraryItemTool: {
        params: { itemId: string; toolId: string };
        response: AppSettings;
      };
      repairLibraryItemTool: {
        params: { itemId: string; toolId: string };
        response: AppSettings;
      };
      getUpdateState: {
        params: undefined;
        response: AppUpdateState;
      };
      checkForUpdates: {
        params: undefined;
        response: AppUpdateState;
      };
      downloadUpdate: {
        params: undefined;
        response: AppUpdateState;
      };
      applyUpdate: {
        params: undefined;
        response: undefined;
      };
    };
    messages: {
      libraryItemsUpdated: {
        libraryItems: LibraryItemSummary[];
        reason: string;
      };
      githubImportRequested: GitHubImportDraft;
      updateStatusChanged: UpdateStatusEntry;
      autoGitBackupCompleted: GitBackupResult;
    };
  };
  webview: {
    requests: EmptyRPC;
    messages: EmptyRPC;
  };
};
