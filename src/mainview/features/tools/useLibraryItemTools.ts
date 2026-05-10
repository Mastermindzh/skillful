import { appRpc } from "@mainview-bridge";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppError } from "../../../shared/errors";
import type {
  AppSettings,
  LibraryItemDocument,
  LibraryItemToolStatus,
} from "../../../shared/types";
import { useAppTranslation } from "../../i18n/i18n";
import { notify } from "../notifications/notify";

type ToolAction = "install" | "remove" | "repair";

export type MissingToolParentRequest = {
  toolId: string;
  action: ToolAction;
  parentPath: string;
};

type UseLibraryItemToolsOptions = {
  activeLibraryItem: LibraryItemDocument | null;
  setAppSettings: (settings: AppSettings) => void;
  setError: (message: string | null) => void;
};

/**
 * Coordinates skill-to-tool mappings with the real install state on disk.
 * Tool actions update settings only after the backend install/remove/repair work succeeds.
 */
export function useLibraryItemTools({
  activeLibraryItem,
  setAppSettings,
  setError,
}: UseLibraryItemToolsOptions) {
  const { t } = useAppTranslation();
  const [toolStatuses, setToolStatuses] = useState<LibraryItemToolStatus[]>([]);
  const [toolActionId, setToolActionId] = useState<string | null>(null);
  const [missingParentRequest, setMissingParentRequest] = useState<MissingToolParentRequest | null>(
    null
  );
  const [creatingMissingParent, setCreatingMissingParent] = useState(false);
  const activeItemIdRef = useRef<string | null>(null);
  const loadRequestSequenceRef = useRef(0);

  useEffect(() => {
    activeItemIdRef.current = activeLibraryItem?.item.id ?? null;
  }, [activeLibraryItem?.item.id]);

  const loadToolStatuses = useCallback(
    async (itemId: string) => {
      const requestSequence = ++loadRequestSequenceRef.current;
      try {
        const nextStatuses = await appRpc.request.getLibraryItemToolStatuses({ itemId });
        if (
          activeItemIdRef.current !== itemId ||
          loadRequestSequenceRef.current !== requestSequence
        ) {
          return;
        }
        setToolStatuses(nextStatuses);
        setError(null);
      } catch (nextError) {
        if (
          activeItemIdRef.current !== itemId ||
          loadRequestSequenceRef.current !== requestSequence
        ) {
          return;
        }
        const message = nextError instanceof Error ? nextError.message : t("tool.error.status");
        setError(message);
        notify.error(message, { title: t("tool.notification.statusTitle") });
        setToolStatuses([]);
      }
    },
    [setError, t]
  );

  const runToolAction = useCallback(
    async (
      toolId: string,
      action: ToolAction,
      options: { promptForMissingParent?: boolean } = {}
    ) => {
      if (!activeLibraryItem) return;
      setToolActionId(toolId);
      const promptForMissingParent = options.promptForMissingParent ?? true;
      const labels = {
        progress: t(`tool.action.${action}.progress`),
        past: t(`tool.action.${action}.past`),
        title: t(`tool.action.${action}.title`),
      };
      const toastId = `tool-${action}-${toolId}-${activeLibraryItem.item.id}`;
      notify.loading(`${labels.progress}\u2026`, { id: toastId, title: labels.title });
      try {
        const nextSettings =
          action === "install"
            ? await appRpc.request.installLibraryItemTool({
                itemId: activeLibraryItem.item.id,
                toolId,
              })
            : action === "remove"
              ? await appRpc.request.removeLibraryItemTool({
                  itemId: activeLibraryItem.item.id,
                  toolId,
                })
              : await appRpc.request.repairLibraryItemTool({
                  itemId: activeLibraryItem.item.id,
                  toolId,
                });
        setAppSettings(nextSettings);
        await loadToolStatuses(activeLibraryItem.item.id);
        setError(null);
        const toolName = nextSettings.tools.find((tool) => tool.id === toolId)?.name ?? toolId;
        notify.update(
          toastId,
          "success",
          t("tool.action.doneMessage", {
            actionPast: labels.past,
            item: activeLibraryItem.item.title,
            tool: toolName,
          }),
          { title: labels.title }
        );
      } catch (nextError) {
        if (
          promptForMissingParent &&
          nextError instanceof AppError &&
          nextError.code === "tool-install-missing-root" &&
          typeof nextError.details?.path === "string"
        ) {
          notify.dismiss(toastId);
          setError(null);
          setMissingParentRequest({
            toolId,
            action,
            parentPath: nextError.details.path,
          });
          return;
        }
        const message =
          nextError instanceof Error ? nextError.message : t("tool.error.action", { action });
        setError(message);
        notify.update(toastId, "error", message, { title: labels.title });
      } finally {
        setToolActionId(null);
      }
    },
    [activeLibraryItem, loadToolStatuses, setAppSettings, setError, t]
  );

  const cancelMissingParentInstall = useCallback(() => {
    setMissingParentRequest(null);
  }, []);

  const createMissingParentAndRetry = useCallback(async () => {
    if (!missingParentRequest) return;
    setCreatingMissingParent(true);
    try {
      await appRpc.request.createDirectory({ path: missingParentRequest.parentPath });
      const request = missingParentRequest;
      setMissingParentRequest(null);
      await runToolAction(request.toolId, request.action, { promptForMissingParent: false });
    } catch (nextError) {
      const message =
        nextError instanceof Error ? nextError.message : t("tool.missingParent.error");
      setError(message);
      notify.error(message, { title: t("tool.missingParent.title") });
    } finally {
      setCreatingMissingParent(false);
    }
  }, [missingParentRequest, runToolAction, setError, t]);

  useEffect(() => {
    if (!activeLibraryItem?.item.id) {
      setToolStatuses([]);
      return;
    }
    void loadToolStatuses(activeLibraryItem.item.id);
  }, [activeLibraryItem, loadToolStatuses]);

  const refreshToolStatuses = useCallback(() => {
    if (!activeLibraryItem?.item.id) return;
    void loadToolStatuses(activeLibraryItem.item.id);
  }, [activeLibraryItem, loadToolStatuses]);

  return {
    loadToolStatuses,
    missingParentDialog: {
      confirming: creatingMissingParent,
      onCancel: cancelMissingParentInstall,
      onConfirm: createMissingParentAndRetry,
      request: missingParentRequest,
    },
    refreshToolStatuses,
    runToolAction,
    toolActionId,
    toolStatuses,
  };
}
