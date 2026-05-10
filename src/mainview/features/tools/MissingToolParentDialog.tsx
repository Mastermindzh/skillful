import { Stack, Text } from "@mantine/core";
import { ConfirmDialog } from "../../components/dialogs/ConfirmDialog";
import { useAppTranslation } from "../../i18n/i18n";
import type { MissingToolParentRequest } from "./useLibraryItemTools";

type MissingToolParentDialogProps = {
  confirming: boolean;
  request: MissingToolParentRequest | null;
  onCancel: () => void;
  onConfirm: () => void;
};

export function MissingToolParentDialog({
  confirming,
  request,
  onCancel,
  onConfirm,
}: MissingToolParentDialogProps) {
  const { t } = useAppTranslation();
  return (
    <ConfirmDialog
      opened={Boolean(request)}
      title={t("tool.missingParent.title")}
      description={
        <Stack gap="xs">
          <Text size="sm">{t("tool.missingParent.description")}</Text>
          <Text size="sm" ff="monospace" className="missing-tool-parent-path">
            {request?.parentPath ?? ""}
          </Text>
          <Text size="sm">{t("tool.missingParent.warning")}</Text>
        </Stack>
      }
      confirming={confirming}
      errorMessage={null}
      confirmLabel={t("tool.missingParent.confirm")}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}
