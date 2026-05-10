import { portablePathLeafName } from "../../../shared/paths";
import type { ImportCollectionFieldErrors } from "./importCollectionModels";

/** Derives the default collection name from the selected source folder path. */
export function importedCollectionName(sourcePath: string) {
  const leafName = portablePathLeafName(sourcePath);
  return leafName.replace(/\.skillful\.zip$/i, "").replace(/\.zip$/i, "");
}

/** Maps backend import failures onto the field they actually belong to in the modal. */
export function classifyImportCollectionError(
  errorMessage: string | null
): ImportCollectionFieldErrors {
  if (!errorMessage) return {};

  if (
    errorMessage.includes("Collection name") ||
    errorMessage.includes("A collection with that name already exists.")
  ) {
    return { name: errorMessage };
  }

  if (
    errorMessage.includes("Imported folder path") ||
    errorMessage.includes("Imported archive path") ||
    errorMessage.includes("Imported archive must be") ||
    errorMessage.includes("collection archive") ||
    errorMessage.includes("selected folder does not contain any skill or agent folders")
  ) {
    return { sourcePath: errorMessage };
  }

  if (errorMessage.includes("GitHub repository")) {
    return { repo: errorMessage };
  }

  if (errorMessage.includes("GitHub ref")) {
    return { ref: errorMessage };
  }

  if (errorMessage.includes("GitHub path")) {
    return { path: errorMessage };
  }

  return { form: errorMessage };
}
