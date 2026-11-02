import { ActionIcon, Tooltip } from "@mantine/core";
import { Eye, Pencil } from "lucide-react";
import type { EditorViewMode } from "../../../shared/types";
import { useAppTranslation } from "../../i18n/i18n";

type ViewModeToggleProps = {
  viewMode: EditorViewMode;
  onViewModeChange: (value: EditorViewMode) => void;
};

export function ViewModeToggle({ viewMode, onViewModeChange }: ViewModeToggleProps) {
  const { t } = useAppTranslation();
  const label = viewMode === "preview" ? t("details.edit") : t("details.preview");
  return (
    <Tooltip label={label} withArrow>
      <ActionIcon
        variant="subtle"
        color="gray"
        size="lg"
        className="editor-view-toggle"
        aria-label={label}
        onClick={() => onViewModeChange(viewMode === "preview" ? "edit" : "preview")}
      >
        {viewMode === "preview" ? <Pencil size={16} /> : <Eye size={16} />}
      </ActionIcon>
    </Tooltip>
  );
}
