import { Text } from "@mantine/core";

type EmptyStateProps = {
  title: string;
  message: string;
  className?: string;
};

export function EmptyState({ title, message, className = "editor-empty-state" }: EmptyStateProps) {
  return (
    <div className={className}>
      <Text size="sm" fw={600}>
        {title}
      </Text>
      <Text size="xs">{message}</Text>
    </div>
  );
}
