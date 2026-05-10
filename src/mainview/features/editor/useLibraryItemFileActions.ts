import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LibraryItemAdditionalFile, LibraryItemFile } from "../../../shared/types";
import { useAppTranslation } from "../../i18n/i18n";
import { ADDITIONAL_FILES_TAB } from "./constants";
import type { PendingFileTarget } from "./models";
import type { LibraryItemDetailsFileActions } from "./types";
import { toUploadPayload } from "./uploads";

type UseLibraryItemFileActionsOptions = {
  activeFile: LibraryItemFile | null;
  documentId: string | null;
  fileActions: LibraryItemDetailsFileActions;
  onActiveRelativePathChange: (value: string | null) => void;
  saving: boolean;
};

export function useLibraryItemFileActions({
  activeFile,
  documentId,
  fileActions,
  onActiveRelativePathChange,
  saving,
}: UseLibraryItemFileActionsOptions) {
  const { t } = useAppTranslation();
  const [createFileOpen, setCreateFileOpen] = useState(false);
  const [createFileError, setCreateFileError] = useState<string | null>(null);
  const [renameFileTarget, setRenameFileTarget] = useState<PendingFileTarget | null>(null);
  const [renameFileError, setRenameFileError] = useState<string | null>(null);
  const [deleteFileTarget, setDeleteFileTarget] = useState<PendingFileTarget | null>(null);
  const [deleteFileError, setDeleteFileError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [fileActionPath, setFileActionPath] = useState<string | null>(null);
  const previousDocumentIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (previousDocumentIdRef.current === documentId) return;
    previousDocumentIdRef.current = documentId;
    setCreateFileError(null);
    setRenameFileError(null);
    setRenameFileTarget(null);
    setDeleteFileError(null);
    setDeleteFileTarget(null);
    setUploadError(null);
    setFileActionPath(null);
  }, [documentId]);

  const createFile = useCallback(
    async (name: string) => {
      try {
        const created = await fileActions.onCreateFile(name);
        if (created) {
          setCreateFileError(null);
          setCreateFileOpen(false);
          return created;
        }
        return null;
      } catch (error) {
        setCreateFileError(error instanceof Error ? error.message : t("file.error.create"));
        return null;
      }
    },
    [fileActions, t]
  );

  const renameFile = useCallback(
    async (name: string) => {
      if (!renameFileTarget) return null;

      try {
        const renamed =
          renameFileTarget.kind === "editable"
            ? await fileActions.onRenameFile(renameFileTarget.relativePath, name)
            : await fileActions.onRenameAdditionalFile(renameFileTarget.relativePath, name);
        if (renamed) {
          setRenameFileError(null);
          setRenameFileTarget(null);
        }
        return renamed;
      } catch (error) {
        setRenameFileError(error instanceof Error ? error.message : t("file.error.rename"));
        return null;
      }
    },
    [fileActions, renameFileTarget, t]
  );

  const uploadFiles = useCallback(
    async (nextFiles: File[] | null) => {
      if (!nextFiles || nextFiles.length === 0) return;

      try {
        const files = await Promise.all(
          nextFiles.map((file) => toUploadPayload(file, t("file.error.read")))
        );
        const uploaded = await fileActions.onUploadFiles(files);
        if (uploaded) {
          setUploadError(null);
          onActiveRelativePathChange(ADDITIONAL_FILES_TAB);
        }
      } catch (error) {
        setUploadError(error instanceof Error ? error.message : t("file.error.upload"));
      }
    },
    [fileActions, onActiveRelativePathChange, t]
  );

  const deleteFile = useCallback(async () => {
    if (!deleteFileTarget) return;

    try {
      const deleted =
        deleteFileTarget.kind === "editable"
          ? await fileActions.onDeleteFile(deleteFileTarget.relativePath)
          : await fileActions.onDeleteAdditionalFile(deleteFileTarget.relativePath);
      if (deleted) {
        setDeleteFileError(null);
        setDeleteFileTarget(null);
      }
    } catch (error) {
      setDeleteFileError(error instanceof Error ? error.message : t("file.error.delete"));
    }
  }, [deleteFileTarget, fileActions, t]);

  const renameCurrentFile = useCallback(() => {
    if (!activeFile || activeFile.isEntry) return;
    setRenameFileError(null);
    setRenameFileTarget({
      relativePath: activeFile.relativePath,
      absolutePath: activeFile.absolutePath,
      label: activeFile.relativePath,
      kind: "editable",
    });
  }, [activeFile]);

  const deleteCurrentFile = useCallback(() => {
    if (!activeFile || activeFile.isEntry) return;
    setDeleteFileError(null);
    setDeleteFileTarget({
      relativePath: activeFile.relativePath,
      absolutePath: activeFile.absolutePath,
      label: activeFile.relativePath,
      kind: "editable",
    });
  }, [activeFile]);

  const renameAdditionalFile = useCallback((file: LibraryItemAdditionalFile, label: string) => {
    setRenameFileError(null);
    setRenameFileTarget({
      relativePath: file.relativePath,
      absolutePath: file.absolutePath,
      label,
      kind: "additional",
    });
  }, []);

  const deleteAdditionalFile = useCallback((file: LibraryItemAdditionalFile, label: string) => {
    setDeleteFileError(null);
    setDeleteFileTarget({
      relativePath: file.relativePath,
      absolutePath: file.absolutePath,
      label,
      kind: "additional",
    });
  }, []);

  const runAdditionalFileAction = useCallback(
    async (kind: "reveal" | "open", absolutePath: string, action: () => Promise<void>) => {
      setFileActionPath(`${kind}:${absolutePath}`);
      try {
        await action();
      } finally {
        setFileActionPath(null);
      }
    },
    []
  );

  const revealAdditionalFile = useCallback(
    async (absolutePath: string) => {
      await runAdditionalFileAction("reveal", absolutePath, () =>
        fileActions.onRevealFile(absolutePath)
      );
    },
    [fileActions, runAdditionalFileAction]
  );

  const openAdditionalFile = useCallback(
    async (absolutePath: string) => {
      await runAdditionalFileAction("open", absolutePath, () =>
        fileActions.onOpenFile(absolutePath)
      );
    },
    [fileActions, runAdditionalFileAction]
  );

  const currentFileActions = useMemo(
    () => ({
      canManage: Boolean(activeFile && !activeFile.isEntry),
      onCreate: () => setCreateFileOpen(true),
      onRename: renameCurrentFile,
      onDelete: deleteCurrentFile,
    }),
    [activeFile, deleteCurrentFile, renameCurrentFile]
  );

  const additionalFilesState = useMemo(
    () => ({
      saving,
      uploadError,
      actionPath: fileActionPath,
    }),
    [fileActionPath, saving, uploadError]
  );

  const additionalFilesActions = useMemo(
    () => ({
      onUploadFiles: uploadFiles,
      onRenameFile: renameAdditionalFile,
      onDeleteFile: deleteAdditionalFile,
      onRevealFile: revealAdditionalFile,
      onOpenFile: openAdditionalFile,
    }),
    [
      deleteAdditionalFile,
      openAdditionalFile,
      renameAdditionalFile,
      revealAdditionalFile,
      uploadFiles,
    ]
  );

  return {
    additionalFilesActions,
    additionalFilesState,
    createFileDialog: {
      opened: createFileOpen,
      errorMessage: createFileError,
      onClose: () => {
        setCreateFileError(null);
        setCreateFileOpen(false);
      },
      onCreate: createFile,
    },
    currentFileActions,
    deleteFileDialog: {
      opened: Boolean(deleteFileTarget),
      errorMessage: deleteFileError,
      fileLabel: deleteFileTarget?.label ?? "",
      onCancel: () => {
        setDeleteFileError(null);
        setDeleteFileTarget(null);
      },
      onDelete: deleteFile,
    },
    renameFileDialog: {
      opened: Boolean(renameFileTarget),
      errorMessage: renameFileError,
      label: renameFileTarget?.label ?? "",
      onClose: () => {
        setRenameFileError(null);
        setRenameFileTarget(null);
      },
      onRename: renameFile,
    },
  };
}
