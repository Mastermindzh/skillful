import { Modal, SegmentedControl, Select, Stack, Text, Textarea, TextInput } from "@mantine/core";
import type { ComponentPropsWithoutRef } from "react";
import { useEffect, useMemo, useState } from "react";
import type { CreateLibraryItemInput, LibraryItemKind } from "../../../shared/types";
import { DialogErrorMessage } from "../../components/dialogs/DialogErrorMessage";
import { DialogFooter } from "../../components/dialogs/DialogFooter";
import { useAppTranslation } from "../../i18n/i18n";

type CreateLibraryItemCollection = {
  id: string;
  title: string;
};

type CreateLibraryItemModalProps = {
  opened: boolean;
  saving: boolean;
  errorMessage: string | null;
  collections: CreateLibraryItemCollection[];
  defaultCollectionId: string | null;
  onClose: () => void;
  onCreate: (input: CreateLibraryItemInput) => Promise<boolean>;
};

export function CreateLibraryItemModal({
  opened,
  saving,
  errorMessage,
  collections,
  defaultCollectionId,
  onClose,
  onCreate,
}: CreateLibraryItemModalProps) {
  const { t } = useAppTranslation();
  const [kind, setKind] = useState<LibraryItemKind>("skill");
  const [collectionId, setCollectionId] = useState<string | null>(defaultCollectionId);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!opened) {
      setKind("skill");
      setCollectionId(defaultCollectionId);
      setName("");
      setDescription("");
      return;
    }

    setCollectionId(defaultCollectionId ?? collections[0]?.id ?? null);
  }, [collections, defaultCollectionId, opened]);

  const collectionOptions = useMemo(
    () =>
      collections.map((collection) => ({
        value: collection.id,
        label: collection.title,
      })),
    [collections]
  );

  const selectedCollection =
    collections.find((collection) => collection.id === collectionId) ?? null;
  const canCreate =
    Boolean(selectedCollection) && name.trim().length > 0 && description.trim().length > 0;
  const kindTitle = t(kind === "agent" ? "item.kind.agent" : "item.kind.skill");
  const kindLabel = kindTitle.toLowerCase();

  const handleSubmit: ComponentPropsWithoutRef<"form">["onSubmit"] = async (event) => {
    event.preventDefault();
    if (!selectedCollection) return;

    const created = await onCreate({
      kind,
      collectionId: selectedCollection.id,
      name,
      description,
    });

    if (created) {
      setName("");
      setDescription("");
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title={t("item.create.title")} centered>
      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          {collectionOptions.length > 0 ? (
            <>
              <SegmentedControl
                fullWidth
                value={kind}
                onChange={(value) => setKind(value as LibraryItemKind)}
                data={[
                  { label: t("item.kind.skill"), value: "skill" },
                  { label: t("item.kind.agent"), value: "agent" },
                ]}
              />
              <Select
                label={t("item.collection")}
                data={collectionOptions}
                value={collectionId}
                onChange={setCollectionId}
                allowDeselect={false}
                data-autofocus
              />
              <TextInput
                label={t("item.name", { kind: kindTitle })}
                placeholder={
                  kind === "agent"
                    ? t("item.name.agentPlaceholder")
                    : t("item.name.skillPlaceholder")
                }
                value={name}
                onChange={(event) => setName(event.currentTarget.value)}
              />
              <Textarea
                label={t("item.description")}
                placeholder={t("item.descriptionPlaceholder")}
                value={description}
                minRows={3}
                onChange={(event) => setDescription(event.currentTarget.value)}
              />
            </>
          ) : (
            <Text size="sm" c="dimmed">
              {t("item.createCollectionFirst")}
            </Text>
          )}

          <DialogErrorMessage message={errorMessage} />

          <DialogFooter
            confirmType="submit"
            confirmLabel={t("item.create.submit", { kind: kindLabel })}
            confirmLoading={saving}
            confirmDisabled={!canCreate}
          />
        </Stack>
      </form>
    </Modal>
  );
}
