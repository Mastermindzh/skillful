import { Badge } from "@mantine/core";
import { useAppTranslation } from "../../../i18n/i18n";
import type { TranslationKey } from "../../../i18n/messages";

type PendingRemovalBadgeProps = {
  /**
   * Translation key for the badge label. Defaults to the tools-flavour copy
   * because that is the most common call site; the library panel passes its
   * own key.
   */
  labelKey?: TranslationKey;
};

/**
 * Small "Marked for removal - applies on Save" badge shared by tool rows and
 * scan-root rows.
 */
export function PendingRemovalBadge({
  labelKey = "settings.tools.markedForRemoval",
}: PendingRemovalBadgeProps) {
  const { t } = useAppTranslation();
  return (
    <Badge size="xs" color="red" variant="light">
      {t(labelKey)}
    </Badge>
  );
}
