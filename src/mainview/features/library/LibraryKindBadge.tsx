import { Badge } from "@mantine/core";
import { Bot, FolderCog } from "lucide-react";
import type { LibraryItemKind } from "../../../shared/types";
import { useAppTranslation } from "../../i18n/i18n";

type LibraryKindBadgeProps = {
  kind: LibraryItemKind;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
};

export function LibraryKindBadge({ kind, size = "sm" }: LibraryKindBadgeProps) {
  const { t } = useAppTranslation();
  const isAgent = kind === "agent";
  const iconSize = size === "xs" ? 11 : 12;

  return (
    <Badge
      size={size}
      variant="light"
      className={
        isAgent
          ? "library-kind-badge library-kind-badge-agent"
          : "library-kind-badge library-kind-badge-skill"
      }
      leftSection={isAgent ? <Bot size={iconSize} /> : <FolderCog size={iconSize} />}
    >
      {isAgent ? t("item.kind.agent") : t("item.kind.skill")}
    </Badge>
  );
}
