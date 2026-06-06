import type { GitHubImportDraft } from "../../../shared/githubImport";
import type { AppRPC } from "../../../shared/rpc";
import type {
  AppSettings,
  LibraryItemCollectionSummary,
  LibraryItemDocument,
} from "../../../shared/types";
import type { AppUpdateState } from "../../../shared/updates";

export type LibraryItemsUpdatedPayload = AppRPC["bun"]["messages"]["libraryItemsUpdated"];
export type GitHubImportRequestedPayload = GitHubImportDraft;
export type AutoGitBackupCompletedPayload = AppRPC["bun"]["messages"]["autoGitBackupCompleted"];
export type RequestSchema = AppRPC["bun"]["requests"];
export type RequestClient = {
  [K in keyof RequestSchema]: (
    params: RequestSchema[K]["params"]
  ) => Promise<RequestSchema[K]["response"]>;
};

export type MockFixture = {
  settings?: Partial<AppSettings>;
  collections?: LibraryItemCollectionSummary[];
  documents?: LibraryItemDocument[];
  updateState?: Partial<AppUpdateState>;
  pickImportFolderPath?: string | null;
  pickImportArchivePath?: string | null;
  pickCollectionExportFolderPath?: string | null;
  missingToolParentPath?: string;
  githubImports?: Record<
    string,
    {
      collection: LibraryItemCollectionSummary;
      documents: LibraryItemDocument[];
    }
  >;
  archiveImports?: Record<
    string,
    {
      collection: LibraryItemCollectionSummary;
      documents: LibraryItemDocument[];
    }
  >;
  pendingGitHubImport?: GitHubImportDraft;
};

export type MockState = {
  settings: AppSettings;
  collections: LibraryItemCollectionSummary[];
  documents: LibraryItemDocument[];
  updateState: AppUpdateState;
};

declare global {
  interface Window {
    __SKILLFUL_E2E_FIXTURE__?: MockFixture;
  }
}
