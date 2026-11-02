import { appRpc } from "@mainview-bridge";
import { useCallback, useMemo, useState } from "react";
import { AppError } from "../../../shared/errors";
import type {
  EditorViewMode,
  SaveToolInstructionsFileInput,
  ToolInstructionsDocument,
  ToolInstructionsFile,
} from "../../../shared/types";
import { usePendingAction } from "../../components/dialogs/usePendingAction";
import { useAppTranslation } from "../../i18n/i18n";
import { notify } from "../notifications/notify";

type Status = "idle" | "loading" | "saving";

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function saveInput(file: ToolInstructionsFile, content: string): SaveToolInstructionsFileInput {
  return {
    relativePath: file.relativePath,
    content,
    baseContent: file.exists ? file.content : null,
  };
}

function withoutPaths(drafts: Record<string, string>, paths: Set<string>) {
  return Object.fromEntries(Object.entries(drafts).filter(([path]) => !paths.has(path)));
}

/**
 * Owns the "edit a tool's own instructions" view that replaces the item details pane: the open
 * document, per-file drafts, and the two prompts it can raise (unsaved changes before leaving,
 * and files that changed on disk since they were opened).
 */
export function useToolInstructions(defaultEditorMode: EditorViewMode) {
  const { t } = useAppTranslation();
  const [toolId, setToolId] = useState<string | null>(null);
  const [document, setDocument] = useState<ToolInstructionsDocument | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [activePath, setActivePath] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<EditorViewMode>(defaultEditorMode);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const pendingAction = usePendingAction();
  const { defer: deferAction } = pendingAction;
  const [conflict, setConflict] = useState<{
    paths: string[];
    files: SaveToolInstructionsFileInput[];
  } | null>(null);
  const [createRuleOpen, setCreateRuleOpen] = useState(false);
  const [createRuleError, setCreateRuleError] = useState<string | null>(null);

  const dirtyFiles = useMemo(
    () =>
      document?.files.filter(
        (file) =>
          drafts[file.relativePath] !== undefined && drafts[file.relativePath] !== file.content
      ) ?? [],
    [document, drafts]
  );
  const dirtyPaths = useMemo(
    () => new Set(dirtyFiles.map((file) => file.relativePath)),
    [dirtyFiles]
  );
  const activeFile = document?.files.find((file) => file.relativePath === activePath) ?? null;

  const reset = useCallback(() => {
    setToolId(null);
    setDocument(null);
    setDrafts({});
    setActivePath(null);
    setError(null);
    setConflict(null);
  }, []);

  /** Runs `action` now, or once the user saved or discarded unsaved edits. */
  const guard = useCallback(
    (action: () => void) => {
      if (dirtyFiles.length > 0) {
        deferAction(action);
        return;
      }
      action();
    },
    [deferAction, dirtyFiles.length]
  );

  const load = useCallback(
    async (nextToolId: string) => {
      setToolId(nextToolId);
      setDocument(null);
      setDrafts({});
      setConflict(null);
      setError(null);
      setViewMode(defaultEditorMode);
      setStatus("loading");
      try {
        const nextDocument = await appRpc.request.readToolInstructions({ toolId: nextToolId });
        setDocument(nextDocument);
        setActivePath(nextDocument.files[0]?.relativePath ?? null);
      } catch (nextError) {
        notify.error(errorMessage(nextError, t("instructions.error.open")), {
          title: t("instructions.notification.openTitle"),
        });
        reset();
      } finally {
        setStatus("idle");
      }
    },
    [defaultEditorMode, reset, t]
  );

  const open = useCallback(
    (nextToolId: string) => {
      if (nextToolId === toolId) return;
      guard(() => void load(nextToolId));
    },
    [guard, load, toolId]
  );

  /**
   * Leaves the instructions view, then runs `then` (e.g. selecting a library item). When the view
   * is not open, `then` runs right away, so callers do not need to check first.
   */
  const close = useCallback(
    (then?: () => void) => {
      if (!toolId) {
        then?.();
        return;
      }
      guard(() => {
        reset();
        then?.();
      });
    },
    [guard, reset, toolId]
  );

  const writeFiles = useCallback(
    async (files: SaveToolInstructionsFileInput[], overwrite = false) => {
      if (!toolId || files.length === 0) return true;
      setStatus("saving");
      setError(null);
      try {
        const nextDocument = await appRpc.request.saveToolInstructions({
          toolId,
          files,
          overwrite,
        });
        setDocument(nextDocument);
        setDrafts((current) =>
          withoutPaths(current, new Set(files.map((file) => file.relativePath)))
        );
        setConflict(null);
        return true;
      } catch (nextError) {
        if (nextError instanceof AppError && nextError.code === "tool-instructions-changed") {
          const paths = Array.isArray(nextError.details?.paths)
            ? nextError.details.paths.map(String)
            : [];
          setConflict({ paths, files });
          return false;
        }
        setError(errorMessage(nextError, t("instructions.error.save")));
        return false;
      } finally {
        setStatus("idle");
      }
    },
    [t, toolId]
  );

  const saveFiles = useCallback(
    (files: ToolInstructionsFile[]) =>
      writeFiles(files.map((file) => saveInput(file, drafts[file.relativePath] ?? file.content))),
    [drafts, writeFiles]
  );
  const saveAll = useCallback(() => saveFiles(dirtyFiles), [dirtyFiles, saveFiles]);
  const saveCurrent = useCallback(
    () => saveFiles(activeFile && dirtyPaths.has(activeFile.relativePath) ? [activeFile] : []),
    [activeFile, dirtyPaths, saveFiles]
  );

  const updateDraft = useCallback((relativePath: string, value: string) => {
    setDrafts((current) => ({ ...current, [relativePath]: value }));
  }, []);

  /** Drops edits to the files that changed on disk and shows their current content. */
  const reloadConflict = useCallback(async () => {
    if (!conflict || !toolId) return;
    setDrafts((current) => withoutPaths(current, new Set(conflict.paths)));
    setConflict(null);
    try {
      setDocument(await appRpc.request.readToolInstructions({ toolId }));
    } catch (nextError) {
      setError(errorMessage(nextError, t("instructions.error.open")));
    }
  }, [conflict, t, toolId]);

  const createRule = useCallback(
    async (name: string) => {
      if (!toolId) return false;
      setStatus("saving");
      setCreateRuleError(null);
      try {
        const created = await appRpc.request.createToolInstructionsRule({ toolId, name });
        setDocument(created.document);
        setActivePath(created.relativePath);
        setViewMode("edit");
        setCreateRuleOpen(false);
        return true;
      } catch (nextError) {
        setCreateRuleError(errorMessage(nextError, t("instructions.error.createRule")));
        return false;
      } finally {
        setStatus("idle");
      }
    },
    [t, toolId]
  );

  return {
    toolId,
    document,
    drafts,
    activeFile,
    activePath,
    setActivePath,
    viewMode,
    setViewMode,
    dirtyPaths,
    hasUnsavedChanges: dirtyFiles.length > 0,
    loading: status === "loading",
    saving: status === "saving",
    error,
    open,
    close,
    updateDraft,
    saveAll,
    saveCurrent,
    unsavedDialog: {
      opened: pendingAction.pending,
      onSave: async () => {
        const action = pendingAction.take();
        // A failed save (e.g. an outside edit) leaves the user on the current files to sort it out.
        if (await saveAll()) action?.();
      },
      onDiscard: () => {
        const action = pendingAction.take();
        setDrafts({});
        action?.();
      },
      onCancel: pendingAction.cancel,
    },
    conflictDialog: {
      opened: conflict !== null,
      paths: conflict?.paths ?? [],
      onOverwrite: () => {
        if (conflict) void writeFiles(conflict.files, true);
      },
      onReload: () => void reloadConflict(),
      onCancel: () => setConflict(null),
    },
    createRuleDialog: {
      opened: createRuleOpen,
      errorMessage: createRuleError,
      open: () => {
        setCreateRuleError(null);
        setCreateRuleOpen(true);
      },
      onClose: () => setCreateRuleOpen(false),
      onCreate: createRule,
    },
  };
}

export type ToolInstructionsState = ReturnType<typeof useToolInstructions>;
