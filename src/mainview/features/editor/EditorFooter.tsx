import { Anchor, Group, Text } from "@mantine/core";
import type { ReactNode } from "react";
import { useAppTranslation } from "../../i18n/i18n";

type EditorFooterProps = {
  absolutePath: string;
  dirtyCount: number;
  installedToolCount?: number;
  repairToolCount?: number;
  blockedToolCount?: number;
  onRevealPath: (absolutePath: string) => void;
  /** Extra status shown right after the path. */
  children?: ReactNode;
};

export function EditorFooter({
  absolutePath,
  dirtyCount,
  installedToolCount = 0,
  repairToolCount = 0,
  blockedToolCount = 0,
  onRevealPath,
  children,
}: EditorFooterProps) {
  const { t } = useAppTranslation();
  return (
    <div className="detail-pane-footer">
      <Group gap="xs" wrap="wrap" className="skill-footer-status">
        <Anchor
          component="button"
          type="button"
          size="xs"
          c="dimmed"
          className="editor-path"
          onClick={() => onRevealPath(absolutePath)}
          title={t("footer.revealPath", { path: absolutePath })}
        >
          {absolutePath}
        </Anchor>
        {children}
        {dirtyCount > 0 ? (
          <Text size="xs" c="ember.4">
            {t("footer.unsaved", { count: dirtyCount })}
          </Text>
        ) : null}
        {installedToolCount > 0 ? (
          <Text size="xs" c="dimmed">
            {t("footer.installed", { count: installedToolCount })}
          </Text>
        ) : null}
        {repairToolCount > 0 ? (
          <Text size="xs" c="orange.4">
            {t("footer.installNeedsRepair")}
          </Text>
        ) : null}
        {blockedToolCount > 0 ? (
          <Text size="xs" c="red.5">
            {t("footer.installBlocked")}
          </Text>
        ) : null}
      </Group>
    </div>
  );
}
