import { slugFromText } from "../../../../shared/library";
import type { LibraryItemCollectionSummary } from "../../../../shared/types";
import { fixtureConfig } from "../fixtures";
import { clone } from "../helpers";
import {
  emitLibraryItemsUpdatedForReason,
  findCollection,
  listCollectionsInternal,
  state,
} from "../state";
import type { RequestClient } from "../types";

type MockArchiveImport = NonNullable<typeof fixtureConfig.archiveImports>[string];
type MockGitHubImport = NonNullable<typeof fixtureConfig.githubImports>[string];

function collectionFromArchiveImport(archive: MockArchiveImport, name: string) {
  const collection = clone(archive.collection);
  collection.title = name.trim() || collection.title;
  if (!state.collections.some((entry) => entry.id === collection.id)) {
    state.collections.push(collection);
  }
  for (const document of archive.documents) {
    state.documents.push(clone(document));
  }
  return collection;
}

function collectionFromGitHubImport(githubImport: MockGitHubImport, name: string) {
  const collection = clone(githubImport.collection);
  collection.title = name.trim() || collection.title;
  if (!state.collections.some((entry) => entry.id === collection.id)) {
    state.collections.push(collection);
  }
  for (const document of githubImport.documents) {
    state.documents.push(clone(document));
  }
  return collection;
}

const collectionRequestsCore = {
  async listCollections() {
    return listCollectionsInternal();
  },
  async createCollection({ name }) {
    const trimmed = name.trim();
    const collection: LibraryItemCollectionSummary = {
      id: slugFromText(trimmed),
      title: trimmed,
    };
    state.collections.push(collection);
    emitLibraryItemsUpdatedForReason("create-collection");
    return clone(collection);
  },
  async pickImportFolder() {
    return fixtureConfig.pickImportFolderPath ?? null;
  },
  async pickImportArchive() {
    return fixtureConfig.pickImportArchivePath ?? fixtureConfig.pickImportFolderPath ?? null;
  },
  async pickCollectionExportFolder() {
    return fixtureConfig.pickCollectionExportFolderPath ?? "/mock/exports";
  },
  async pickToolInstallFolder() {
    return "/mock/home/tool/install-root";
  },
  async importCollection(input) {
    const archive = fixtureConfig.archiveImports?.[input.sourcePath];
    if (!archive) {
      throw new Error("Import is not available in the E2E mock harness.");
    }

    const collection = collectionFromArchiveImport(archive, input.name);
    emitLibraryItemsUpdatedForReason("import-collection");
    return clone(collection);
  },
  async importCollectionArchive(input) {
    const archive = fixtureConfig.archiveImports?.[input.archivePath];
    if (!archive) {
      throw new Error("Archive import is not available in the E2E mock harness.");
    }

    const collection = collectionFromArchiveImport(archive, input.name);
    emitLibraryItemsUpdatedForReason("import-collection-archive");
    return clone(collection);
  },
  async importCollectionFromGitHub(input) {
    const key = JSON.stringify({
      repo: input.repo,
      ref: input.ref ?? "",
      path: input.path ?? "",
    });
    const githubImport = fixtureConfig.githubImports?.[key];
    if (!githubImport) {
      throw new Error("GitHub import is not available in the E2E mock harness.");
    }

    const collection = collectionFromGitHubImport(githubImport, input.name);
    emitLibraryItemsUpdatedForReason("import-collection-github");
    return clone(collection);
  },
  async exportCollectionArchive({ collectionId, destinationFolder }) {
    const collection = findCollection(collectionId);
    if (!collection) {
      throw new Error("Collection not found.");
    }

    return {
      archivePath: `${destinationFolder}/${slugFromText(collection.title)}.skillful.zip`,
    };
  },
  async renameCollection({ id, name }) {
    const collection = findCollection(id);
    if (!collection) {
      throw new Error("Collection not found.");
    }
    collection.title = name.trim();
    emitLibraryItemsUpdatedForReason("rename-collection");
    return clone(collection);
  },
  async deleteCollection({ id }) {
    state.collections = state.collections.filter((collection) => collection.id !== id);
    state.documents = state.documents.filter((document) => document.item.collectionId !== id);
    emitLibraryItemsUpdatedForReason("delete-collection");
    return {
      collections: listCollectionsInternal(),
      libraryItems: state.documents.map((document) => clone(document.item)),
    };
  },
} satisfies Pick<
  RequestClient,
  | "listCollections"
  | "createCollection"
  | "pickImportFolder"
  | "pickImportArchive"
  | "pickCollectionExportFolder"
  | "pickToolInstallFolder"
  | "importCollection"
  | "importCollectionArchive"
  | "importCollectionFromGitHub"
  | "exportCollectionArchive"
  | "renameCollection"
  | "deleteCollection"
>;

export const collectionRequests = {
  ...collectionRequestsCore,
};
