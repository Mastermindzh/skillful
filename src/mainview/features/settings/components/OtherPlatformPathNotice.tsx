import { Text } from "@mantine/core";
import { isAbsolutePath, isAbsolutePathOnPlatform } from "../../../../shared/paths";
import type { Platform } from "../../../../shared/types";
import { useAppTranslation } from "../../../i18n/i18n";

type OtherPlatformPathNoticeProps = {
  path: string;
  platform?: Platform;
};

/** Flags an absolute path that belongs to another OS, e.g. one restored from a synced backup. */
export function OtherPlatformPathNotice({ path, platform }: OtherPlatformPathNoticeProps) {
  const { t } = useAppTranslation();
  const value = path.trim();
  if (!platform || !isAbsolutePath(value) || isAbsolutePathOnPlatform(value, platform)) {
    return null;
  }
  return (
    <Text size="xs" c="yellow.8">
      {t("settings.error.otherPlatformPath")}
    </Text>
  );
}
