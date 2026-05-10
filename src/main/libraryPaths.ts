import path from "node:path";
import { LIBRARY_FOLDER_BY_KIND } from "../shared/library";
import type { LibraryItemKind } from "../shared/types";

export { LIBRARY_FOLDER_BY_KIND };

export function libraryRootPath(scanRoot: string, kind: LibraryItemKind) {
  return path.join(scanRoot, LIBRARY_FOLDER_BY_KIND[kind]);
}

export function collectionDirectory(scanRoot: string, kind: LibraryItemKind, collectionId: string) {
  return path.join(libraryRootPath(scanRoot, kind), collectionId);
}
