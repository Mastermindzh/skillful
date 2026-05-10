import { Alert, List, Text } from "@mantine/core";
import { AlertTriangle } from "lucide-react";
import { useAppTranslation } from "../../i18n/i18n";

type MetadataWarningPanelProps = {
  warnings: string[];
};

export function MetadataWarningPanel({ warnings }: MetadataWarningPanelProps) {
  const { t } = useAppTranslation();
  if (warnings.length === 0) return null;

  return (
    <Alert
      color="yellow"
      icon={<AlertTriangle size={16} />}
      title={t("metadata.title")}
      className="metadata-warning-panel"
      role="status"
      aria-label={t("metadata.ariaLabel")}
    >
      <Text size="sm" mb={6}>
        {t("metadata.description", {
          nameKey: "name",
          descriptionKey: "description",
        })}
      </Text>
      <List size="sm" spacing={2}>
        {warnings.map((warning) => (
          <List.Item key={warning}>{warning}</List.Item>
        ))}
      </List>
    </Alert>
  );
}
