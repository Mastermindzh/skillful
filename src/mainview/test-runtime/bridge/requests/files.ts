import { frontmatterMetadataWarningsForFiles } from "../../../../shared/frontmatter";
import { clone, fileLabelToRelativePath, renameRelativePath } from "../helpers";
import {
  emitLibraryItemsUpdatedForReason,
  findLibraryItem,
  updateSummary,
  withAbsolutePath,
} from "../state";
import type { RequestClient } from "../types";

function saveWarnings(
  document: { item: { entryPath: string } },
  files: Array<{ relativePath: string; content: string }>
) {
  return frontmatterMetadataWarningsForFiles(document.item.entryPath, files);
}

export const fileRequests = {
  async createLibraryItemFile({ id, name }) {
    const document = findLibraryItem(id);
    if (!document) {
      throw new Error("Item not found.");
    }
    const relativePath = fileLabelToRelativePath(name);
    if (document.files.some((file) => file.relativePath === relativePath)) {
      throw new Error("A file with that name already exists.");
    }
    document.files.push({
      relativePath,
      absolutePath: withAbsolutePath(document.item.rootPath, relativePath),
      content: `# ${relativePath.replace(/\.md$/i, "").replace(/[-_]+/g, " ")}\n\n`,
      isEntry: false,
    });
    updateSummary(document);
    emitLibraryItemsUpdatedForReason("create-file");
    return clone(document);
  },
  async renameLibraryItemFile({ id, relativePath, name }) {
    const document = findLibraryItem(id);
    if (!document) {
      throw new Error("Item not found.");
    }
    const file = document.files.find(
      (entry) => entry.relativePath === relativePath && !entry.isEntry
    );
    if (!file) {
      throw new Error("File not found.");
    }
    file.relativePath = renameRelativePath(relativePath, name);
    file.absolutePath = withAbsolutePath(document.item.rootPath, file.relativePath);
    updateSummary(document);
    emitLibraryItemsUpdatedForReason("rename-file");
    return clone(document);
  },
  async renameAdditionalLibraryItemFile({ id, relativePath, name }) {
    const document = findLibraryItem(id);
    if (!document) {
      throw new Error("Item not found.");
    }
    const file = document.additionalFiles.find((entry) => entry.relativePath === relativePath);
    if (!file) {
      throw new Error("Additional file not found.");
    }
    file.relativePath = renameRelativePath(relativePath, name);
    file.absolutePath = withAbsolutePath(document.item.rootPath, file.relativePath);
    return clone(document);
  },
  async uploadLibraryItemFiles({ id, files }) {
    const document = findLibraryItem(id);
    if (!document) {
      throw new Error("Item not found.");
    }
    for (const file of files) {
      if (!document.additionalFiles.some((entry) => entry.relativePath === file.name)) {
        document.additionalFiles.push({
          relativePath: file.name,
          absolutePath: withAbsolutePath(document.item.rootPath, file.name),
        });
      }
    }
    return clone(document);
  },
  async deleteAdditionalLibraryItemFile({ id, relativePath }) {
    const document = findLibraryItem(id);
    if (!document) {
      throw new Error("Item not found.");
    }
    document.additionalFiles = document.additionalFiles.filter(
      (file) => file.relativePath !== relativePath
    );
    return clone(document);
  },
  async deleteLibraryItemFile({ id, relativePath }) {
    const document = findLibraryItem(id);
    if (!document) {
      throw new Error("Item not found.");
    }
    document.files = document.files.filter(
      (file) => file.relativePath !== relativePath || file.isEntry
    );
    updateSummary(document);
    emitLibraryItemsUpdatedForReason("delete-file");
    return clone(document);
  },
  async openPath() {},
  async revealPath() {},
  async saveLibraryItem({ id, relativePath, content }) {
    const document = findLibraryItem(id);
    if (!document) {
      throw new Error("Item not found.");
    }
    const file = document.files.find((entry) => entry.relativePath === relativePath);
    if (!file) {
      throw new Error("File not found.");
    }
    file.content = content;
    const warnings = saveWarnings(document, [{ relativePath, content }]);
    return warnings.length > 0 ? clone({ ...document, warnings }) : clone(document);
  },
  async saveLibraryItemFiles({ id, files }) {
    const document = findLibraryItem(id);
    if (!document) {
      throw new Error("Item not found.");
    }
    for (const update of files) {
      const file = document.files.find((entry) => entry.relativePath === update.relativePath);
      if (file) {
        file.content = update.content;
      }
    }
    const warnings = saveWarnings(document, files);
    return warnings.length > 0 ? clone({ ...document, warnings }) : clone(document);
  },
} satisfies Pick<
  RequestClient,
  | "createLibraryItemFile"
  | "renameLibraryItemFile"
  | "renameAdditionalLibraryItemFile"
  | "uploadLibraryItemFiles"
  | "deleteAdditionalLibraryItemFile"
  | "deleteLibraryItemFile"
  | "openPath"
  | "revealPath"
  | "saveLibraryItem"
  | "saveLibraryItemFiles"
>;
