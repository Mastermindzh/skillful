import type { CreateLibraryItemInput } from "../shared/types";
import { UnsavedChangesDialog } from "./components/UnsavedChangesDialog";
import { CreateCollectionModal } from "./features/navigation/CreateCollectionModal";
import { DeleteCollectionDialog } from "./features/navigation/DeleteCollectionDialog";
import { ImportCollectionModal } from "./features/navigation/ImportCollectionModal";
import { RenameCollectionModal } from "./features/navigation/RenameCollectionModal";
import type { CollectionDialogs } from "./features/navigation/useCollectionDialogs";
import { KeyboardShortcutsModal } from "./features/shortcuts/KeyboardShortcutsModal";
import { CreateLibraryItemModal } from "./features/skills/CreateLibraryItemModal";
import { DeleteLibraryItemDialog } from "./features/skills/DeleteLibraryItemDialog";
import type { LibraryCollection } from "./features/skills/libraryItems";
import { MoveLibraryItemModal } from "./features/skills/MoveLibraryItemModal";
import { RenameLibraryItemModal } from "./features/skills/RenameLibraryItemModal";
import type { LibraryItemDialogs } from "./features/skills/useLibraryItemDialogs";
import type { LibraryItemLibrary } from "./features/skills/useLibraryItemLibrary";
import { MissingToolParentDialog } from "./features/tools/MissingToolParentDialog";
import type { LibraryItemTools } from "./features/tools/useLibraryItemTools";

type UnsavedPrompt = {
  opened: boolean;
  onSave: () => Promise<void>;
  onDiscard: () => void;
  onCancel: () => void;
};

type AppDialogsProps = {
  library: LibraryItemLibrary;
  collectionDialogs: CollectionDialogs;
  itemDialogs: LibraryItemDialogs;
  writableCollections: LibraryCollection[];
  onCreateItem: (input: CreateLibraryItemInput) => Promise<boolean>;
  shortcuts: { opened: boolean; onClose: () => void };
  missingToolParent: LibraryItemTools["missingParentDialog"];
  instructionsFromSettings: UnsavedPrompt;
};

/** Whether any library, collection or shortcut dialog rendered by `AppDialogs` is open. */
export function appDialogOpen({
  library,
  collectionDialogs,
  itemDialogs,
  shortcutsOpened,
}: {
  library: LibraryItemLibrary;
  collectionDialogs: CollectionDialogs;
  itemDialogs: LibraryItemDialogs;
  shortcutsOpened: boolean;
}) {
  return (
    collectionDialogs.create.opened ||
    collectionDialogs.import.opened ||
    Boolean(collectionDialogs.delete.target) ||
    Boolean(collectionDialogs.rename.target) ||
    Boolean(itemDialogs.delete.target) ||
    Boolean(itemDialogs.move.target) ||
    Boolean(itemDialogs.rename.target) ||
    shortcutsOpened ||
    library.unsavedDialogOpen
  );
}

/** The app-wide dialogs for collections, library items, shortcuts and unsaved changes. */
export function AppDialogs({
  library,
  collectionDialogs,
  itemDialogs,
  writableCollections,
  onCreateItem,
  shortcuts,
  missingToolParent,
  instructionsFromSettings,
}: AppDialogsProps) {
  const activeItemKind = library.activeLibraryItem?.item.kind ?? "skill";
  return (
    <>
      <CreateCollectionModal
        opened={collectionDialogs.create.opened}
        saving={collectionDialogs.create.saving}
        errorMessage={collectionDialogs.create.errorMessage}
        onClose={collectionDialogs.create.close}
        onCreate={collectionDialogs.create.onCreate}
      />

      <ImportCollectionModal
        opened={collectionDialogs.import.opened}
        saving={collectionDialogs.import.saving}
        errorMessage={collectionDialogs.import.errorMessage}
        draft={collectionDialogs.import.draft}
        onClose={collectionDialogs.import.close}
        onClearError={collectionDialogs.import.clearError}
        onPickFolder={collectionDialogs.import.onPickFolder}
        onPickArchive={collectionDialogs.import.onPickArchive}
        onImportFolder={collectionDialogs.import.onImportFolder}
        onImportArchive={collectionDialogs.import.onImportArchive}
        onImportGitHub={collectionDialogs.import.onImportGitHub}
      />

      <RenameCollectionModal
        opened={Boolean(collectionDialogs.rename.target)}
        currentName={collectionDialogs.rename.target?.title ?? ""}
        saving={library.status === "loading"}
        errorMessage={collectionDialogs.rename.errorMessage}
        onClose={collectionDialogs.rename.close}
        onRename={collectionDialogs.rename.onRename}
      />

      <CreateLibraryItemModal
        opened={itemDialogs.create.opened}
        saving={itemDialogs.create.saving}
        errorMessage={itemDialogs.create.errorMessage}
        collections={writableCollections}
        defaultCollectionId={itemDialogs.create.defaultCollectionId}
        onClose={itemDialogs.create.close}
        onCreate={onCreateItem}
      />

      <RenameLibraryItemModal
        opened={Boolean(itemDialogs.rename.target)}
        itemKind={itemDialogs.rename.target?.kind ?? activeItemKind}
        currentName={itemDialogs.rename.target?.title ?? ""}
        saving={library.status === "saving"}
        errorMessage={itemDialogs.rename.errorMessage}
        onClose={itemDialogs.rename.close}
        onRename={itemDialogs.rename.onRename}
      />

      <MoveLibraryItemModal
        opened={Boolean(itemDialogs.move.target)}
        itemKind={itemDialogs.move.target?.kind ?? activeItemKind}
        itemTitle={itemDialogs.move.target?.title ?? ""}
        currentCollectionId={itemDialogs.move.target?.collectionId ?? ""}
        collections={writableCollections}
        saving={itemDialogs.move.moving}
        errorMessage={itemDialogs.move.errorMessage}
        onClose={itemDialogs.move.close}
        onMove={itemDialogs.move.onMove}
      />

      <DeleteCollectionDialog
        opened={Boolean(collectionDialogs.delete.target)}
        collectionTitle={collectionDialogs.delete.target?.title ?? ""}
        deleting={collectionDialogs.delete.deleting}
        errorMessage={collectionDialogs.delete.errorMessage}
        onCancel={collectionDialogs.delete.close}
        onDelete={() => void collectionDialogs.delete.onDelete()}
      />

      <DeleteLibraryItemDialog
        opened={Boolean(itemDialogs.delete.target)}
        itemKind={itemDialogs.delete.target?.kind ?? "skill"}
        libraryItemTitle={itemDialogs.delete.target?.title ?? ""}
        deleting={itemDialogs.delete.deleting}
        errorMessage={itemDialogs.delete.errorMessage}
        onCancel={itemDialogs.delete.close}
        onDelete={() => void itemDialogs.delete.onDelete()}
      />

      <KeyboardShortcutsModal opened={shortcuts.opened} onClose={shortcuts.onClose} />

      <MissingToolParentDialog
        confirming={missingToolParent.confirming}
        request={missingToolParent.request}
        onCancel={missingToolParent.onCancel}
        onConfirm={() => void missingToolParent.onConfirm()}
      />

      <UnsavedChangesDialog
        opened={instructionsFromSettings.opened}
        onSave={() => void instructionsFromSettings.onSave()}
        onDiscard={instructionsFromSettings.onDiscard}
        onCancel={instructionsFromSettings.onCancel}
      />

      <UnsavedChangesDialog
        opened={library.unsavedDialogOpen}
        onSave={() => void library.confirmSaveAndNavigate()}
        onDiscard={library.discardAndNavigate}
        onCancel={library.cancelNavigation}
      />
    </>
  );
}
