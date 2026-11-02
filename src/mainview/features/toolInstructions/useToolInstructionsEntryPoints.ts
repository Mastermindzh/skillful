import { useCallback, useMemo } from "react";
import type { CreateLibraryItemInput, ToolConfig } from "../../../shared/types";
import { useAppTranslation } from "../../i18n/i18n";
import { useOpenInstructionsFromSettings } from "./useOpenInstructionsFromSettings";
import type { ToolInstructionsState } from "./useToolInstructions";

type UseToolInstructionsEntryPointsOptions = {
  instructions: ToolInstructionsState;
  tools: ToolConfig[] | undefined;
  /** Tool whose scope is selected in the sidebar, if any. */
  activeToolId: string | null;
  requestItemChange: (id: string | null) => void;
  createItem: (input: CreateLibraryItemInput) => Promise<boolean>;
  settingsHaveChanges: boolean;
  saveSettings: () => Promise<boolean>;
  closeSettings: () => void;
};

/**
 * Wires the instructions view into the rest of the app: the list header button, the settings
 * button, and leaving the view when a library item is selected or created.
 */
export function useToolInstructionsEntryPoints({
  instructions,
  tools,
  activeToolId,
  requestItemChange,
  createItem,
  settingsHaveChanges,
  saveSettings,
  closeSettings,
}: UseToolInstructionsEntryPointsOptions) {
  const { t } = useAppTranslation();
  const { toolId: openToolId, open, close } = instructions;

  const selectItem = useCallback(
    (id: string | null) => close(() => requestItemChange(id)),
    [close, requestItemChange]
  );

  const createItemAndShow = useCallback(
    async (input: CreateLibraryItemInput) => {
      const created = await createItem(input);
      // The new item becomes active, so show it instead of the instructions it was created over.
      if (created) close();
      return created;
    },
    [close, createItem]
  );

  const activeTool = tools?.find((tool) => tool.id === activeToolId) ?? null;
  const listHeaderAction = useMemo(
    () =>
      activeTool?.instructionsPath
        ? {
            label: t("instructions.open", { tool: activeTool.name }),
            active: openToolId === activeTool.id,
            onOpen: () => open(activeTool.id),
          }
        : null,
    [activeTool, open, openToolId, t]
  );

  const fromSettings = useOpenInstructionsFromSettings({
    settingsHaveChanges,
    saveSettings,
    closeSettings,
    openInstructions: open,
  });

  return { selectItem, createItem: createItemAndShow, listHeaderAction, fromSettings };
}
