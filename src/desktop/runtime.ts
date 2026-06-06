import { ensureDirectory } from "../main/fs";
import { measureAsync } from "../main/performance";
import { LibraryItemStore } from "../main/skills";
import type {
  DesktopRequestHandlers,
  DesktopRuntimeAdapters,
  DesktopShellAdapter,
  DesktopUpdateAdapter,
} from "./adapters";

export type {
  DesktopRequestHandlers,
  DesktopRuntimeAdapters,
  DesktopShellAdapter,
  DesktopUpdateAdapter,
};

function samePathSet(left: string[], right: string[]) {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every((entry) => rightSet.has(entry));
}

/**
 * Runtime-agnostic desktop application service.
 *
 * This is the seam between the filesystem-first Skillful core and the shell runtime. It
 * depends only on Node-compatible filesystem modules (via `LibraryItemStore`) and the injected
 * adapters for dialogs, shell integration, IPC messages, and updates, so the library,
 * scanner, installer, and React feature code stay free of any shell-specific imports.
 */
export async function createDesktopRuntime(adapters: DesktopRuntimeAdapters) {
  const service = new LibraryItemStore();
  await measureAsync(
    "desktop.startup.scanAll",
    () => service.scanAll(),
    (libraryItems) => ({
      items: libraryItems.length,
    })
  );

  // `LibraryItemStore.watch` stops any existing watchers before installing new ones, so this helper
  // is safe to call whenever config changes (scan roots, watched directories, etc.).
  async function startWatching() {
    await service.watch((libraryItems, reason) => {
      adapters.sendLibraryItemsUpdated(libraryItems, reason);
    });
  }

  const handlers: DesktopRequestHandlers = {
    getConfig: async () => service.getConfig(),
    setOnboardingTourCompleted: async ({ completed }) =>
      service.setOnboardingTourCompleted(completed),
    saveConfig: async (nextConfig) => {
      const previousConfig = await service.getConfig();
      const config = await measureAsync("desktop.saveConfig.persistAndReconcile", () =>
        service.saveConfig(nextConfig)
      );
      adapters.shell.setMinimizeToTrayOnClose(config.minimizeToTrayOnClose);
      if (!samePathSet(previousConfig.effectiveScanRoots, config.effectiveScanRoots)) {
        const libraryItems = await measureAsync(
          "desktop.saveConfig.rescan",
          () => service.scanAll(),
          (items) => ({ items: items.length })
        );
        await measureAsync("desktop.saveConfig.startWatching", startWatching);
        adapters.sendLibraryItemsUpdated(libraryItems, "config");
      }
      return config;
    },
    listLibraryItems: async () => service.listLibraryItems(),
    listCollections: async () => service.listCollections(),
    createCollection: async ({ name }) => service.createCollection(name),
    pickImportFolder: async () => adapters.pickDirectory(),
    pickImportArchive: async () => adapters.pickFile("zip"),
    pickCollectionExportFolder: async () => adapters.pickDirectory(),
    pickToolInstallFolder: async () => adapters.pickDirectory(),
    importCollection: async (input) => service.importCollection(input),
    importCollectionArchive: async (input) => service.importCollectionArchive(input),
    importCollectionFromGitHub: async (input) => service.importCollectionFromGitHub(input),
    exportCollectionArchive: async (input) => service.exportCollectionArchive(input),
    renameCollection: async ({ id, name }) => service.renameCollection(id, name),
    createLibraryItem: async (input) => service.createLibraryItem(input),
    renameLibraryItem: async ({ id, name }) => service.renameLibraryItem(id, name),
    moveLibraryItem: async (input) => service.moveLibraryItem(input),
    createLibraryItemFile: async ({ id, name }) => service.createLibraryItemFile(id, name),
    renameLibraryItemFile: async ({ id, relativePath, name }) =>
      service.renameLibraryItemFile(id, relativePath, name),
    uploadLibraryItemFiles: async ({ id, files }) => service.uploadLibraryItemFiles(id, files),
    renameAdditionalLibraryItemFile: async ({ id, relativePath, name }) =>
      service.renameAdditionalLibraryItemFile(id, relativePath, name),
    deleteAdditionalLibraryItemFile: async ({ id, relativePath }) =>
      service.deleteAdditionalLibraryItemFile(id, relativePath),
    deleteLibraryItemFile: async ({ id, relativePath }) =>
      service.deleteLibraryItemFile(id, relativePath),
    deleteLibraryItem: async ({ id }) => service.deleteLibraryItem(id),
    openPath: async ({ path }) => {
      await adapters.shell.openPath(path);
      return undefined;
    },
    revealPath: async ({ path }) => {
      await adapters.shell.revealPath(path);
      return undefined;
    },
    createDirectory: async ({ path }) => {
      await ensureDirectory(path);
      return undefined;
    },
    deleteCollection: async ({ id }) => service.deleteCollection(id),
    readLibraryItem: async ({ id }) => service.readLibraryItem(id),
    saveLibraryItem: async ({ id, relativePath, content }) =>
      service.saveLibraryItem(id, relativePath, content),
    saveLibraryItemFiles: async ({ id, files }) => service.saveLibraryItemFiles(id, files),
    refreshLibraryItems: async () => service.scanAll(),
    getLibraryItemToolStatuses: async ({ itemId }) => service.getLibraryItemToolStatuses(itemId),
    installLibraryItemTool: async ({ itemId, toolId }) =>
      service.installLibraryItemTool(itemId, toolId),
    removeLibraryItemTool: async ({ itemId, toolId }) =>
      service.removeLibraryItemTool(itemId, toolId),
    repairLibraryItemTool: async ({ itemId, toolId }) =>
      service.repairLibraryItemTool(itemId, toolId),
    getUpdateState: async () => adapters.updater.getUpdateState(),
    checkForUpdates: async () => adapters.updater.checkForUpdates(),
    downloadUpdate: async () => adapters.updater.downloadUpdate(),
    applyUpdate: async () => {
      await adapters.updater.applyUpdate();
      return undefined;
    },
  };

  adapters.updater.onUpdateStatusChange((entry) => {
    adapters.sendUpdateStatusChanged(entry);
  });
  adapters.shell.setMinimizeToTrayOnClose((await service.getConfig()).minimizeToTrayOnClose);

  return {
    handlers,
    startWatching,
    // Narrow accessor for shell-level diagnostics (e.g. the bun entry point logs effective
    // scan roots on startup). Intentionally does not expose the full `LibraryItemStore` so shells
    // cannot bypass the request handlers.
    getConfig: () => service.getConfig(),
  };
}
