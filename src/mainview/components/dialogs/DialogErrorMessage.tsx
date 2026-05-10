import { Text } from "@mantine/core";

type DialogErrorMessageProps = {
  message?: string | null;
};

export function DialogErrorMessage({ message }: DialogErrorMessageProps) {
  if (!message) return null;

  return (
    <Text size="sm" c="red.7" style={{ overflowWrap: "anywhere", whiteSpace: "pre-wrap" }}>
      {message}
    </Text>
  );
}
