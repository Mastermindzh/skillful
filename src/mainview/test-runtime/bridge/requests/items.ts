import {
  buildNewDocument,
  clone,
  emitLibraryItemsUpdatedForReason,
  findLibraryItem,
  listSkillsInternal,
  state,
  updateSummary,
} from "../state";
import type { RequestClient } from "../types";

export const itemRequests = {
  async listLibraryItems() {
    return clone(listSkillsInternal());
  },
  async createLibraryItem(input) {
    const document = buildNewDocument(input);
    state.documents.push(document);
    emitLibraryItemsUpdatedForReason("create-item");
    return clone(document.item);
  },
  async renameLibraryItem({ id, name }) {
    const document = findLibraryItem(id);
    if (!document) {
      throw new Error("Item not found.");
    }
    document.item.title = name.trim();
    updateSummary(document);
    emitLibraryItemsUpdatedForReason("rename-item");
    return clone(document);
  },
  async moveLibraryItem({ id, collectionId }) {
    const document = findLibraryItem(id);
    if (!document) {
      throw new Error("Item not found.");
    }
    const collection = state.collections.find((entry) => entry.id === collectionId);
    if (!collection) {
      throw new Error("Collection not found.");
    }
    const previousId = document.item.id;
    document.item.collectionId = collection.id;
    document.item.rootPath = document.item.rootPath.replace(
      /\/[^/]+\/([^/]+)$/,
      `/${collection.id}/$1`
    );
    document.item.entryPath = `${
      document.item.rootPath
    }/${document.files.find((file) => file.isEntry)?.relativePath ?? "SKILL.md"}`;
    document.item.id = `${previousId}-moved-${collection.id}`;
    for (const file of document.files) {
      file.absolutePath = `${document.item.rootPath}/${file.relativePath}`;
    }
    for (const file of document.additionalFiles) {
      file.absolutePath = `${document.item.rootPath}/${file.relativePath}`;
    }
    state.settings.toolMappings = state.settings.toolMappings.map((mapping) =>
      mapping.itemId === previousId ? { ...mapping, itemId: document.item.id } : mapping
    );
    updateSummary(document);
    emitLibraryItemsUpdatedForReason("move-item");
    return clone(document);
  },
  async deleteLibraryItem({ id }) {
    state.documents = state.documents.filter((document) => document.item.id !== id);
    state.settings.toolMappings = state.settings.toolMappings.filter(
      (mapping) => mapping.itemId !== id
    );
    emitLibraryItemsUpdatedForReason("delete-item");
    return clone(listSkillsInternal());
  },
  async readLibraryItem({ id }) {
    const document = findLibraryItem(id);
    if (!document) {
      throw new Error("Item not found.");
    }
    return clone(document);
  },
  async refreshLibraryItems() {
    return clone(listSkillsInternal());
  },
} satisfies Pick<
  RequestClient,
  | "listLibraryItems"
  | "createLibraryItem"
  | "renameLibraryItem"
  | "moveLibraryItem"
  | "deleteLibraryItem"
  | "readLibraryItem"
  | "refreshLibraryItems"
>;
