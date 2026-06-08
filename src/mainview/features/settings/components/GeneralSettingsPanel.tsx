import { NativeSelect, Stack, Switch, Title } from "@mantine/core";
import type { AppLanguage, EditorViewMode } from "../../../../shared/types";
import { useAppTranslation } from "../../../i18n/i18n";

export type GeneralSettingsPanelProps = {
  language: AppLanguage;
  onLanguageChange: (next: AppLanguage) => void;
  defaultEditorMode: EditorViewMode;
  onDefaultEditorModeChange: (next: EditorViewMode) => void;
  suppressSuccessNotifications: boolean;
  onSuppressSuccessNotificationsChange: (next: boolean) => void;
  minimizeToTrayOnClose: boolean;
  onMinimizeToTrayOnCloseChange: (next: boolean) => void;
};

export function GeneralSettingsPanel({
  language,
  onLanguageChange,
  defaultEditorMode,
  onDefaultEditorModeChange,
  suppressSuccessNotifications,
  onSuppressSuccessNotificationsChange,
  minimizeToTrayOnClose,
  onMinimizeToTrayOnCloseChange,
}: GeneralSettingsPanelProps) {
  const { t } = useAppTranslation();
  const languageOptions = [
    { value: "system", label: t("settings.language.system") },
    { value: "en", label: t("settings.language.en") },
    { value: "nl", label: t("settings.language.nl") },
  ];
  const editorModeOptions = [
    { value: "preview", label: t("settings.general.editorMode.preview") },
    { value: "edit", label: t("settings.general.editorMode.edit") },
  ];

  return (
    <Stack gap="lg">
      <Stack gap={6}>
        <Title order={4}>{t("settings.general.language.title")}</Title>
        <NativeSelect
          label={t("settings.general.language.label")}
          description={t("settings.general.language.description")}
          data={languageOptions}
          value={language}
          onChange={(event) => onLanguageChange(event.currentTarget.value as AppLanguage)}
        />
      </Stack>
      <Stack gap={6}>
        <Title order={4}>{t("settings.general.editorMode.title")}</Title>
        <NativeSelect
          label={t("settings.general.editorMode.label")}
          description={t("settings.general.editorMode.description")}
          data={editorModeOptions}
          value={defaultEditorMode}
          onChange={(event) =>
            onDefaultEditorModeChange(event.currentTarget.value as EditorViewMode)
          }
        />
      </Stack>
      <Stack gap={6}>
        <Title order={4}>{t("settings.general.notifications.title")}</Title>
        <Switch
          checked={suppressSuccessNotifications}
          onChange={(event) => onSuppressSuccessNotificationsChange(event.currentTarget.checked)}
          label={t("settings.general.notifications.hideSuccess")}
          description={t("settings.general.notifications.hideSuccessDescription")}
        />
      </Stack>
      <Stack gap={6}>
        <Title order={4}>{t("settings.general.tray.title")}</Title>
        <Switch
          checked={minimizeToTrayOnClose}
          onChange={(event) => onMinimizeToTrayOnCloseChange(event.currentTarget.checked)}
          label={t("settings.general.tray.minimizeOnClose")}
          description={t("settings.general.tray.minimizeOnCloseDescription")}
        />
      </Stack>
    </Stack>
  );
}
