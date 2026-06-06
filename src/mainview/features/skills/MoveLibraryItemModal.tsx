import { Modal, Select, Stack, Text } from "@mantine/core";
import type { ComponentPropsWithoutRef } from "react";
import { useEffect, useMemo, useState } from "react";
import type { LibraryItemKind } from "../../../shared/types";
import { DialogErrorMessage } from "../../components/dialogs/DialogErrorMessage";
import { DialogFooter } from "../../components/dialogs/DialogFooter";
import { useAppTranslation } from "../../i18n/i18n";

type MoveLibraryItemCollection = {
  id: string;
  title: string;
};

type MoveLibraryItemModalProps = {
  opened: boolean;
  itemKind: LibraryItemKind;
  itemTitle: string;
  currentCollectionId: string;
  collections: MoveLibraryItemCollection[];
  saving: boolean;
  errorMessage: string | null;
  onClose: () => void;
  onMove: (collectionId: string) => Promise<boolean>;
};

export function MoveLibraryItemModal({
  opened,
  itemKind,
  itemTitle,
  currentCollectionId,
  collections,
  saving,
  errorMessage,
  onClose,
  onMove,
}: MoveLibraryItemModalProps) {
  const { t } = useAppTranslation();
  const targetCollections = useMemo(
    () => collections.filter((collection) => collection.id !== currentCollectionId),
    [collections, currentCollectionId]
  );
  const [collectionId, setCollectionId] = useState<string | null>(targetCollections[0]?.id ?? null);
  const kindLabel = t(itemKind === "agent" ? "item.kind.agent" : "item.kind.skill").toLowerCase();

  useEffect(() => {
    if (!opened) return;
    setCollectionId((currentCollectionId) =>
      currentCollectionId &&
      targetCollections.some((collection) => collection.id === currentCollectionId)
        ? currentCollectionId
        : (targetCollections[0]?.id ?? null)
    );
  }, [opened, targetCollections]);

  const collectionOptions = useMemo(
    () =>
      targetCollections.map((collection) => ({
        value: collection.id,
        label: collection.title,
      })),
    [targetCollections]
  );

  const handleSubmit: ComponentPropsWithoutRef<"form">["onSubmit"] = async (event) => {
    event.preventDefault();
    if (!collectionId) return;
    await onMove(collectionId);
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={t("item.move.title", { kind: kindLabel })}
      centered
    >
      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            {t("item.move.description", { name: itemTitle })}
          </Text>
          {collectionOptions.length > 0 ? (
            <Select
              label={t("item.move.destination")}
              data={collectionOptions}
              value={collectionId}
              onChange={setCollectionId}
              allowDeselect={false}
              data-autofocus
            />
          ) : (
            <Text size="sm" c="dimmed">
              {t("item.move.createCollectionFirst", { kind: kindLabel })}
            </Text>
          )}

          <DialogErrorMessage message={errorMessage} />

          <DialogFooter
            confirmType="submit"
            confirmLabel={t("item.move.submit", { kind: kindLabel })}
            confirmLoading={saving}
            confirmDisabled={!collectionId}
          />
        </Stack>
      </form>
    </Modal>
  );
}
