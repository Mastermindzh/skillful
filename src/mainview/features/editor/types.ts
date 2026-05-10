import type { RefObject } from "react";
import type {
  EditorViewMode,
  LibraryItemDocument,
  LibraryItemToolStatus,
  ToolConfig,
} from "../../../shared/types";
import type { DraftMap } from "./drafts";

export type EditorHandle = {
  focus: () => void;
};

export type LibraryItemDetailsSaveState = {
  errorMessage: string | null;
  saving: boolean;
  canSaveCurrent: boolean;
  canSaveAll: boolean;
  onSaveCurrent: () => void;
  onSaveAll: () => void;
};

export type LibraryItemDetailsTooling = {
  tools: ToolConfig[];
  toolStatuses: LibraryItemToolStatus[];
  activeToolActionId: string | null;
  onRefreshToolStatuses: () => void;
  onInstallTool: (toolId: string) => void;
  onRemoveTool: (toolId: string) => void;
  onRepairTool: (toolId: string) => void;
};

export type LibraryItemDetailsFileActions = {
  onCreateFile: (name: string) => Promise<LibraryItemDocument | null>;
  onRenameFile: (relativePath: string, name: string) => Promise<LibraryItemDocument | null>;
  onUploadFiles: (
    files: Array<{ name: string; contentBase64: string }>
  ) => Promise<LibraryItemDocument | null>;
  onRenameAdditionalFile: (
    relativePath: string,
    name: string
  ) => Promise<LibraryItemDocument | null>;
  onDeleteFile: (relativePath: string) => Promise<LibraryItemDocument | null>;
  onDeleteAdditionalFile: (relativePath: string) => Promise<LibraryItemDocument | null>;
  onRevealFile: (absolutePath: string) => Promise<void>;
  onOpenFile: (absolutePath: string) => Promise<void>;
  onRevealItemFolder: (absolutePath: string) => Promise<void>;
};

export type LibraryItemDetailsProps = {
  document: LibraryItemDocument | null;
  collectionTitle: string | null;
  activeRelativePath: string | null;
  onActiveRelativePathChange: (value: string | null) => void;
  drafts: DraftMap;
  onDraftChange: (relativePath: string, value: string) => void;
  viewModeIntent: {
    mode: EditorViewMode;
    token: number;
  };
  saveState: LibraryItemDetailsSaveState;
  tooling: LibraryItemDetailsTooling;
  fileActions: LibraryItemDetailsFileActions;
  editorRef: RefObject<EditorHandle | null>;
};
