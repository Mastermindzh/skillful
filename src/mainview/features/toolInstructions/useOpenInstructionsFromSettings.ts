import { useCallback } from "react";
import { usePendingAction } from "../../components/dialogs/usePendingAction";

type UseOpenInstructionsFromSettingsOptions = {
  settingsHaveChanges: boolean;
  saveSettings: () => Promise<boolean>;
  closeSettings: () => void;
  openInstructions: (toolId: string) => void;
};

/**
 * "Edit instructions" in settings leaves the settings modal, so pending settings edits are saved
 * or discarded first. Saving also matters for correctness: the instructions view reads the saved
 * path, not whatever is typed in the form.
 */
export function useOpenInstructionsFromSettings({
  settingsHaveChanges,
  saveSettings,
  closeSettings,
  openInstructions,
}: UseOpenInstructionsFromSettingsOptions) {
  const pendingOpen = usePendingAction();
  const { defer: deferOpen } = pendingOpen;

  const request = useCallback(
    (toolId: string) => {
      const open = () => openInstructions(toolId);
      if (settingsHaveChanges) {
        deferOpen(open);
        return;
      }
      closeSettings();
      open();
    },
    [closeSettings, deferOpen, openInstructions, settingsHaveChanges]
  );

  return {
    request,
    dialog: {
      opened: pendingOpen.pending,
      onSave: async () => {
        const open = pendingOpen.take();
        // A successful save closes the settings modal itself.
        if (open && (await saveSettings())) open();
      },
      onDiscard: () => {
        const open = pendingOpen.take();
        closeSettings();
        open?.();
      },
      onCancel: pendingOpen.cancel,
    },
  };
}
