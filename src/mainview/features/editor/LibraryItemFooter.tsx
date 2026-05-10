import { Anchor, Group, Text } from "@mantine/core";
import { useAppTranslation } from "../../i18n/i18n";

type LibraryItemFooterProps = {
  absolutePath: string;
  dirtyCount: number;
  installedToolCount: number;
  repairToolCount: number;
  blockedToolCount: number;
  onRevealPath: (absolutePath: string) => void;
};

export function LibraryItemFooter({
  absolutePath,
  dirtyCount,
  installedToolCount,
  repairToolCount,
  blockedToolCount,
  onRevealPath,
}: LibraryItemFooterProps) {
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
