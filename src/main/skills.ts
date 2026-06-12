import { watch } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { AppError } from "../shared/errors";
import { frontmatterMetadataWarningsForFiles } from "../shared/frontmatter";
import type { ImportCollectionFromGitHubInput } from "../shared/githubImport";
import { LIBRARY_ITEM_KINDS } from "../shared/library";
import type {
  AppConfig,
  CreateLibraryItemInput,
  ExportCollectionArchiveInput,
  GitBackupConfig,
  GitBackupRestoreMode,
  ImportCollectionFromArchiveInput,
  ImportCollectionFromPathInput,
  LibraryItemDocument,
  LibraryItemSummary,
  LibraryItemToolMapping,
  MoveLibraryItemInput,
} from "../shared/types";
import {
  exportLibraryCollectionArchive,
  importLibraryCollectionArchive,
} from "./collectionArchives";
import {
  createLibraryCollection,
  importLibraryCollection,
  renameLibraryCollection,
} from "./collections";
import {
  addAdditionalSkillFiles,
  createEditableSkillFile,
  createLibraryItem as createNewSkill,
  deleteAdditionalLibraryItemFile,
  deleteEditableSkillFile,
  deleteLibraryItem,
  moveLibraryItem,
  renameAdditionalLibraryItemFile,
  renameEditableSkillFile,
  renameLibraryItem,
} from "./creation";
import { atomicWriteFile, ensureDirectory, pathExists } from "./fs";
import {
  initializeGitBackup,
  restoreGitBackup as restoreGitBackupFromGit,
  runGitBackup,
} from "./git/backup";
import { importLibraryCollectionFromGitHub } from "./githubImports";
import {
  getLibraryItemToolStatuses,
  repairLibraryItemToolInstall,
  syncLibraryItemInstalls,
} from "./installer";
import { libraryRootPath } from "./libraryPaths";
import { logger } from "./logger";
import { measureAsync } from "./performance";
import { loadScanIndex, saveScanIndex } from "./scanIndexCache";
import {
  compareLibraryItems,
  deleteLibraryCollection,
  discoverLibraryItems,
  type LibraryItemSummaryCache,
  listLibraryCollections,
  readLibraryItemFiles,
  refreshLibraryItemSummary,
  resolveLibraryItemFilePath,
  SKIP_DIRECTORIES,
} from "./scanner";
import {
  defaultAppConfig,
  defaultSkillRoot,
  effectiveScanRoots,
  loadSettingsOrDefaults,
  normalizeAppConfig,
  persistSettings,
  settingsFromConfig,
} from "./settings";

/**
 * Watcher events that arrive within this window after a local mutation completed
 * are treated as echoes of our own writes and skipped. The targeted rescan paths
 * (`refreshLibraryItemSummary`, in-place `libraryItems` updates) have already
 * synced the in-memory store, so re-reading 2k+ files on every mutation is pure
 * waste. 500ms comfortably covers the 150ms watcher debounce plus a scheduling
 * buffer; external edits land on the next tick.
 */
const LOCAL_MUTATION_ECHO_WINDOW_MS = 500;
const watchLogger = logger.scoped("watch");

export class LibraryItemStore {
  private libraryItems = new Map<string, LibraryItemSummary>();
  private summaryCache: LibraryItemSummaryCache = new Map();
  private scanIndexLoaded = false;
  private watchers: Array<{ close: () => void }> = [];
  private rescanTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingRescanRoots = new Set<string>();
  private pendingRescanRebuild = false;
  private localMutationDepth = 0;
  private lastLocalMutationAt = 0;
  private configLoaded = false;
  private configMutex: Promise<void> = Promise.resolve();
  private config: AppConfig;

  constructor(scanRoots?: string[]) {
    this.config = defaultAppConfig(scanRoots);
    this.configLoaded = Boolean(scanRoots && scanRoots.length > 0);
  }

  private async persistConfig() {
    await persistSettings(this.config);
  }

  private async ensureConfigLoaded() {
    if (this.configLoaded) return;
    this.config = await loadSettingsOrDefaults();
    this.configLoaded = true;
  }

  /** Serialises config-mutating operations to prevent interleaved symlink work. */
  private withConfigLock<T>(fn: () => Promise<T>): Promise<T> {
    const wrapped = async () => {
      this.localMutationDepth++;
      try {
        return await fn();
      } finally {
        this.localMutationDepth--;
        this.lastLocalMutationAt = Date.now();
      }
    };
    const next = this.configMutex.then(wrapped, wrapped);
    this.configMutex = next.then(
      () => {},
      () => {}
    );
    return next;
  }

  private isInsideLocalMutationEcho() {
    return (
      this.localMutationDepth > 0 ||
      Date.now() - this.lastLocalMutationAt < LOCAL_MUTATION_ECHO_WINDOW_MS
    );
  }

  async getConfig() {
    await this.ensureConfigLoaded();
    return settingsFromConfig(this.config);
  }

  async initializeGitBackup(gitBackupConfig?: GitBackupConfig) {
    await this.ensureConfigLoaded();
    return initializeGitBackup(gitBackupConfig ?? this.config.gitBackup);
  }

  async runGitBackup() {
    await this.ensureConfigLoaded();
    return runGitBackup(this.config);
  }

  async restoreGitBackup(gitBackupConfig: GitBackupConfig, mode: GitBackupRestoreMode) {
    await this.ensureConfigLoaded();
    const config = normalizeAppConfig({ ...this.config, gitBackup: gitBackupConfig });
    const result = await restoreGitBackupFromGit(config.gitBackup, mode);
    if (!result.restored) {
      throw new AppError("internal", result.message || "Backup restore failed.");
    }
    const restoredConfig = await loadSettingsOrDefaults();
    this.config = normalizeAppConfig(
      restoredConfig.gitBackup.remoteUrl.trim()
        ? restoredConfig
        : { ...restoredConfig, gitBackup: { ...config.gitBackup, branch: result.branch } }
    );
    await this.persistConfig();
    return settingsFromConfig(this.config);
  }

  async saveConfig(nextConfig: AppConfig) {
    return this.withConfigLock(async () => {
      await this.ensureConfigLoaded();

      const previousTools = [...this.config.tools];
      const previousMappings = [...this.config.toolMappings];
      const config = normalizeAppConfig(nextConfig);

      // Persist the new config before reconciling tool installs so a crash mid-reconcile
      // leaves the saved config consistent with the user's intent rather than the old
      // state. Per-skill install failures are logged and do not roll back the config.
      this.config = config;
      this.configLoaded = true;
      await this.persistConfig();

      const libraryItemIds = new Set(
        [...previousMappings, ...config.toolMappings].map((mapping) => mapping.itemId)
      );
      for (const itemId of libraryItemIds) {
        const libraryItem = this.libraryItems.get(itemId);
        if (!libraryItem) continue;
        try {
          await syncLibraryItemInstalls(
            libraryItem,
            previousTools,
            previousMappings,
            config.tools,
            config.toolMappings
          );
        } catch (error) {
          logger.error(`Failed to reconcile tool installs for ${libraryItem.title}.`, error);
        }
      }

      return settingsFromConfig(this.config);
    });
  }

  async setOnboardingTourCompleted(completed: boolean) {
    return this.withConfigLock(async () => {
      await this.ensureConfigLoaded();
      this.config.onboardingTourCompleted = completed;
      await this.persistConfig();
      return settingsFromConfig(this.config);
    });
  }

  /**
   * Lookup helper that throws a consistent `skill-not-found` error when an id
   * is not present in the in-memory cache. Callers should prefer this over
   * hand-rolled presence checks so error messages and codes stay uniform.
   */
  private getLibraryItemOrThrow(itemId: string): LibraryItemSummary {
    const libraryItem = this.libraryItems.get(itemId);
    if (!libraryItem) throw new AppError("skill-not-found", `Skill not found: ${itemId}`);
    return libraryItem;
  }

  private async updateLibraryItemTools(itemId: string, toolIds: string[]) {
    return this.withConfigLock(async () => {
      const libraryItem = this.getLibraryItemOrThrow(itemId);

      const previousMappings = [...this.config.toolMappings];
      const validToolIds = Array.from(
        new Set(
          toolIds
            .map((toolId) => toolId.trim())
            .filter((toolId) => this.config.tools.some((tool) => tool.id === toolId))
        )
      );

      const nextMappings = [
        ...previousMappings.filter((mapping) => mapping.itemId !== itemId),
        ...(validToolIds.length > 0 ? [{ itemId, toolIds: validToolIds }] : []),
      ];

      await syncLibraryItemInstalls(
        libraryItem,
        this.config.tools,
        previousMappings,
        this.config.tools,
        nextMappings
      );
      this.config.toolMappings = nextMappings;
      await this.persistConfig();
      return settingsFromConfig(this.config);
    });
  }

  async getLibraryItemToolStatuses(itemId: string) {
    await this.ensureConfigLoaded();
    const libraryItem = this.getLibraryItemOrThrow(itemId);
    return getLibraryItemToolStatuses(libraryItem, this.config.tools, this.config.toolMappings);
  }

  async installLibraryItemTool(itemId: string, toolId: string) {
    await this.ensureConfigLoaded();
    const libraryItem = this.getLibraryItemOrThrow(itemId);
    const tool = this.config.tools.find((entry) => entry.id === toolId);
    if (!tool) throw new AppError("tool-not-found", `Tool not found: ${toolId}`);
    if ((tool.installRoots[libraryItem.kind] ?? []).length === 0) {
      throw new AppError(
        "tool-install-missing-root",
        `${tool.name} has no ${libraryItem.kind} install folder configured.`
      );
    }
    const currentToolIds =
      this.config.toolMappings.find((mapping) => mapping.itemId === itemId)?.toolIds ?? [];
    return this.updateLibraryItemTools(itemId, [...currentToolIds, toolId]);
  }

  async removeLibraryItemTool(itemId: string, toolId: string) {
    await this.ensureConfigLoaded();
    const currentToolIds =
      this.config.toolMappings.find((mapping) => mapping.itemId === itemId)?.toolIds ?? [];
    return this.updateLibraryItemTools(
      itemId,
      currentToolIds.filter((currentToolId) => currentToolId !== toolId)
    );
  }

  async repairLibraryItemTool(itemId: string, toolId: string) {
    return this.withConfigLock(async () => {
      await this.ensureConfigLoaded();
      const libraryItem = this.getLibraryItemOrThrow(itemId);

      const tool = this.config.tools.find((entry) => entry.id === toolId);
      if (!tool) throw new AppError("tool-not-found", `Tool not found: ${toolId}`);

      const mappedToolIds =
        this.config.toolMappings.find((mapping) => mapping.itemId === itemId)?.toolIds ?? [];
      if (!mappedToolIds.includes(toolId)) {
        // Delegate to install path which runs inside its own lock acquisition.
        // We release by returning from this closure first.
      }

      if (!mappedToolIds.includes(toolId)) {
        return null;
      }

      await repairLibraryItemToolInstall(libraryItem, tool);
      return settingsFromConfig(this.config);
    }).then(async (result) => {
      if (result !== null) return result;
      return this.installLibraryItemTool(itemId, toolId);
    });
  }

  async ensureScanRoots() {
    await this.ensureConfigLoaded();
    await Promise.all(effectiveScanRoots(this.config.scanRoots).map(ensureDirectory));
  }

  async scanAll() {
    return measureAsync(
      "main.scanAll",
      async () => {
        await this.ensureScanRoots();
        // First scan of the process: warm the in-memory cache from disk so mtime
        // comparisons in buildSummaryForEntry can skip readFile+YAML parse for
        // unchanged items. Subsequent scans reuse whatever scanAll already left in
        // memory, so this only pays the JSON parse cost once per run.
        if (!this.scanIndexLoaded) {
          this.scanIndexLoaded = true;
          try {
            const loaded = await loadScanIndex();
            if (loaded.size > 0 && this.summaryCache.size === 0) {
              this.summaryCache = loaded;
            }
          } catch {
            // Treat a missing/corrupt cache file as a cold start; not fatal.
          }
        }
        const roots = effectiveScanRoots(this.config.scanRoots);
        const discovered: LibraryItemSummary[] = [];
        const nextCache: LibraryItemSummaryCache = new Map();
        for (const root of roots) {
          await measureAsync(
            "main.scanAll.root",
            () => discoverLibraryItems(root, discovered, this.summaryCache),
            () => ({ root, discovered: discovered.length })
          );
        }
        // Retain only entries that resurfaced during this scan. Everything else has been
        // renamed, deleted, or moved outside the scan roots and should not keep memory.
        for (const item of discovered) {
          const entry = this.summaryCache.get(item.entryPath);
          if (entry) nextCache.set(item.entryPath, entry);
        }
        this.summaryCache = nextCache;
        discovered.sort(compareLibraryItems);
        this.libraryItems = new Map(discovered.map((libraryItem) => [libraryItem.id, libraryItem]));
        // Fire-and-forget persist; ensures the next cold start can skip YAML parsing.
        void saveScanIndex(this.summaryCache);
        return discovered;
      },
      (libraryItems) => ({
        items: libraryItems.length,
        roots: effectiveScanRoots(this.config.scanRoots).length,
      })
    );
  }

  listLibraryItems() {
    return Array.from(this.libraryItems.values()).sort(compareLibraryItems);
  }

  private setLibraryItem(libraryItem: LibraryItemSummary) {
    this.libraryItems.set(libraryItem.id, libraryItem);
    return libraryItem;
  }

  private async refreshLibraryItem(libraryItem: LibraryItemSummary) {
    const nextLibraryItem = await refreshLibraryItemSummary(libraryItem);
    if (nextLibraryItem.id !== libraryItem.id) {
      this.libraryItems.delete(libraryItem.id);
    }
    return this.setLibraryItem(nextLibraryItem);
  }

  private async refreshLibraryItemDocument(
    libraryItem: LibraryItemSummary,
    warnings: string[] = []
  ): Promise<LibraryItemDocument> {
    const nextLibraryItem = await this.refreshLibraryItem(libraryItem);
    const document = await this.readLibraryItem(nextLibraryItem.id);
    return warnings.length > 0 ? { ...document, warnings } : document;
  }

  /**
   * Renames and moves both change an item's root path, which in turn changes its
   * id (hashed from the resolved root). Tool installs are symlinks pointing at
   * the *old* folder, so they must be torn down before the filesystem operation
   * and rebuilt after the cache resolves the new id. These helpers collect any
   * link-level failures as warnings: the filesystem change itself is the primary
   * operation and should not fail just because one tool link can't be updated.
   */
  private async unlinkToolInstallsBeforeIdChange(
    libraryItem: LibraryItemSummary,
    previousMappings: LibraryItemToolMapping[],
    operation: "rename" | "move",
    warnings: string[]
  ) {
    try {
      await syncLibraryItemInstalls(
        libraryItem,
        this.config.tools,
        previousMappings,
        this.config.tools,
        previousMappings.filter((mapping) => mapping.itemId !== libraryItem.id)
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to remove existing tool installs before ${operation}.`, error);
      warnings.push(`Could not remove old tool installs before ${operation}: ${message}`);
    }
  }

  private async relinkToolInstallsAfterIdChange(
    previousItemId: string,
    previousMapping: LibraryItemToolMapping,
    nextLibraryItem: LibraryItemSummary,
    warnings: string[]
  ) {
    this.config.toolMappings = this.config.toolMappings.map((mapping) =>
      mapping.itemId === previousItemId ? { ...mapping, itemId: nextLibraryItem.id } : mapping
    );
    await this.persistConfig();

    for (const toolId of previousMapping.toolIds) {
      const tool = this.config.tools.find((entry) => entry.id === toolId);
      if (!tool) continue;
      try {
        await repairLibraryItemToolInstall(nextLibraryItem, tool);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error(`Failed to relink ${nextLibraryItem.title} into ${tool.name}.`, error);
        warnings.push(
          `Could not relink "${nextLibraryItem.title}" into "${tool.name}": ${message}`
        );
      }
    }
  }

  async listCollections() {
    return measureAsync(
      "main.listCollections",
      async () => {
        await this.ensureScanRoots();
        return listLibraryCollections(effectiveScanRoots(this.config.scanRoots));
      },
      (collections) => ({ collections: collections.length })
    );
  }

  async createCollection(name: string) {
    await this.ensureScanRoots();
    return createLibraryCollection(defaultSkillRoot(), name);
  }

  async importCollection(input: ImportCollectionFromPathInput) {
    await this.ensureScanRoots();
    const collection = await importLibraryCollection(defaultSkillRoot(), input);
    await this.scanAll();
    return collection;
  }

  async importCollectionArchive(input: ImportCollectionFromArchiveInput) {
    await this.ensureScanRoots();
    const collection = await importLibraryCollectionArchive(defaultSkillRoot(), input);
    await this.scanAll();
    return collection;
  }

  async importCollectionFromGitHub(input: ImportCollectionFromGitHubInput) {
    await this.ensureScanRoots();
    const collection = await importLibraryCollectionFromGitHub(defaultSkillRoot(), input);
    await this.scanAll();
    return collection;
  }

  async exportCollectionArchive(input: ExportCollectionArchiveInput) {
    await this.ensureScanRoots();
    return exportLibraryCollectionArchive(effectiveScanRoots(this.config.scanRoots), input);
  }

  async renameCollection(collectionId: string, name: string) {
    await this.ensureScanRoots();
    return renameLibraryCollection(effectiveScanRoots(this.config.scanRoots), collectionId, name);
  }

  async createLibraryItem(input: CreateLibraryItemInput) {
    return this.withConfigLock(async () => {
      await this.ensureScanRoots();
      const createdLibraryItem = await createNewSkill(
        effectiveScanRoots(this.config.scanRoots),
        input
      );
      return this.setLibraryItem(createdLibraryItem);
    });
  }

  async renameLibraryItem(id: string, name: string): Promise<LibraryItemDocument> {
    return this.withConfigLock(async () => {
      await this.ensureConfigLoaded();

      const libraryItem = this.getLibraryItemOrThrow(id);

      const warnings: string[] = [];
      const previousMappings = [...this.config.toolMappings];
      const previousMapping = previousMappings.find((mapping) => mapping.itemId === id) ?? null;

      if (previousMapping) {
        await this.unlinkToolInstallsBeforeIdChange(
          libraryItem,
          previousMappings,
          "rename",
          warnings
        );
      }

      const renamed = await renameLibraryItem(libraryItem, name);
      const nextLibraryItem = await this.refreshLibraryItem({
        ...libraryItem,
        rootPath: renamed.rootPath,
        entryPath: renamed.entryPath,
      });

      if (previousMapping) {
        await this.relinkToolInstallsAfterIdChange(id, previousMapping, nextLibraryItem, warnings);
      }

      const document = await this.readLibraryItem(nextLibraryItem.id);
      return warnings.length > 0 ? { ...document, warnings } : document;
    });
  }

  async moveLibraryItem(input: MoveLibraryItemInput): Promise<LibraryItemDocument> {
    return this.withConfigLock(async () => {
      await this.ensureScanRoots();

      const libraryItem = this.getLibraryItemOrThrow(input.id);
      if (libraryItem.collectionId === input.collectionId) return this.readLibraryItem(input.id);

      const warnings: string[] = [];
      const previousMappings = [...this.config.toolMappings];
      const previousMapping =
        previousMappings.find((mapping) => mapping.itemId === input.id) ?? null;

      if (previousMapping) {
        await this.unlinkToolInstallsBeforeIdChange(
          libraryItem,
          previousMappings,
          "move",
          warnings
        );
      }

      const moved = await moveLibraryItem(
        effectiveScanRoots(this.config.scanRoots),
        libraryItem,
        input
      );
      const nextLibraryItem = await this.refreshLibraryItem({
        ...libraryItem,
        collectionId: moved.collectionId,
        rootPath: moved.rootPath,
        entryPath: moved.entryPath,
      });

      if (previousMapping) {
        await this.relinkToolInstallsAfterIdChange(
          input.id,
          previousMapping,
          nextLibraryItem,
          warnings
        );
      }

      const document = await this.readLibraryItem(nextLibraryItem.id);
      return warnings.length > 0 ? { ...document, warnings } : document;
    });
  }

  async createLibraryItemFile(id: string, name: string): Promise<LibraryItemDocument> {
    return this.withConfigLock(async () => {
      const libraryItem = this.getLibraryItemOrThrow(id);
      await createEditableSkillFile(libraryItem, name);
      return this.refreshLibraryItemDocument(libraryItem);
    });
  }

  async renameLibraryItemFile(
    id: string,
    relativePath: string,
    name: string
  ): Promise<LibraryItemDocument> {
    return this.withConfigLock(async () => {
      const libraryItem = this.getLibraryItemOrThrow(id);
      await renameEditableSkillFile(libraryItem, relativePath, name);
      return this.refreshLibraryItemDocument(libraryItem);
    });
  }

  async uploadLibraryItemFiles(
    id: string,
    files: Array<{ name: string; contentBase64: string }>
  ): Promise<LibraryItemDocument> {
    return this.withConfigLock(async () => {
      const libraryItem = this.getLibraryItemOrThrow(id);
      await addAdditionalSkillFiles(libraryItem, files);
      return this.refreshLibraryItemDocument(libraryItem);
    });
  }

  async deleteAdditionalLibraryItemFile(
    id: string,
    relativePath: string
  ): Promise<LibraryItemDocument> {
    return this.withConfigLock(async () => {
      const libraryItem = this.getLibraryItemOrThrow(id);
      await deleteAdditionalLibraryItemFile(libraryItem, relativePath);
      return this.refreshLibraryItemDocument(libraryItem);
    });
  }

  async renameAdditionalLibraryItemFile(
    id: string,
    relativePath: string,
    name: string
  ): Promise<LibraryItemDocument> {
    return this.withConfigLock(async () => {
      const libraryItem = this.getLibraryItemOrThrow(id);
      await renameAdditionalLibraryItemFile(libraryItem, relativePath, name);
      return this.refreshLibraryItemDocument(libraryItem);
    });
  }

  async deleteLibraryItemFile(id: string, relativePath: string): Promise<LibraryItemDocument> {
    return this.withConfigLock(async () => {
      const libraryItem = this.getLibraryItemOrThrow(id);
      await deleteEditableSkillFile(libraryItem, relativePath);
      return this.refreshLibraryItemDocument(libraryItem);
    });
  }

  async deleteLibraryItem(id: string): Promise<LibraryItemSummary[]> {
    return this.withConfigLock(async () => {
      const libraryItem = this.getLibraryItemOrThrow(id);
      await deleteLibraryItem(libraryItem);
      // Drop any stale tool mapping for the deleted libraryItem.
      const filteredMappings = this.config.toolMappings.filter((mapping) => mapping.itemId !== id);
      if (filteredMappings.length !== this.config.toolMappings.length) {
        this.config.toolMappings = filteredMappings;
        await this.persistConfig();
      }
      this.libraryItems.delete(id);
      return this.listLibraryItems();
    });
  }

  async deleteCollection(collectionId: string) {
    return this.withConfigLock(async () => {
      await this.ensureScanRoots();
      const collections = await deleteLibraryCollection(
        effectiveScanRoots(this.config.scanRoots),
        collectionId
      );
      const deletedItemIds: string[] = [];
      for (const [id, libraryItem] of this.libraryItems) {
        if (libraryItem.collectionId === collectionId) {
          this.libraryItems.delete(id);
          deletedItemIds.push(id);
        }
      }
      if (deletedItemIds.length > 0) {
        const deletedItemIdSet = new Set(deletedItemIds);
        const filteredMappings = this.config.toolMappings.filter(
          (mapping) => !deletedItemIdSet.has(mapping.itemId)
        );
        if (filteredMappings.length !== this.config.toolMappings.length) {
          this.config.toolMappings = filteredMappings;
          await this.persistConfig();
        }
      }
      return { collections, libraryItems: this.listLibraryItems() };
    });
  }

  async readLibraryItem(id: string): Promise<LibraryItemDocument> {
    const libraryItem = this.getLibraryItemOrThrow(id);
    return { item: libraryItem, ...(await readLibraryItemFiles(libraryItem)) };
  }

  async saveLibraryItem(
    id: string,
    relativePath: string,
    content: string
  ): Promise<LibraryItemDocument> {
    return this.saveLibraryItemFiles(id, [{ relativePath, content }]);
  }

  async saveLibraryItemFiles(
    id: string,
    files: Array<{ relativePath: string; content: string }>
  ): Promise<LibraryItemDocument> {
    return this.withConfigLock(async () => {
      const libraryItem = this.getLibraryItemOrThrow(id);
      await Promise.all(
        files.map(async (file) => {
          const filePath = await resolveLibraryItemFilePath(libraryItem, file.relativePath);
          // Atomic write so a crash mid-save cannot leave a half-written entry file.
          await atomicWriteFile(filePath, file.content, "utf8");
        })
      );
      const warnings = frontmatterMetadataWarningsForFiles(libraryItem.entryPath, files);
      return this.refreshLibraryItemDocument(libraryItem, warnings);
    });
  }

  async watch(onSkillsChanged: (libraryItems: LibraryItemSummary[], reason: string) => void) {
    return this.withConfigLock(() => this.watchLocked(onSkillsChanged));
  }

  private async watchLocked(
    onSkillsChanged: (libraryItems: LibraryItemSummary[], reason: string) => void
  ) {
    this.stopWatching();
    await this.ensureScanRoots();
    for (const root of effectiveScanRoots(this.config.scanRoots)) {
      for (const watchedRoot of await this.watchedLibraryRoots(root)) {
        this.watchers.push(await this.watchRoot(watchedRoot, onSkillsChanged));
      }
    }
    watchLogger.debug("watchers registered", { count: this.watchers.length });
  }

  private async watchedLibraryRoots(scanRoot: string) {
    const roots: string[] = [];
    for (const kind of LIBRARY_ITEM_KINDS) {
      const candidate = libraryRootPath(scanRoot, kind);
      if (await pathExists(candidate)) roots.push(candidate);
    }
    watchLogger.debug("scan root watch targets", { scanRoot, roots });
    return roots;
  }

  private async watchRoot(
    watchedRoot: string,
    onSkillsChanged: (libraryItems: LibraryItemSummary[], reason: string) => void
  ) {
    try {
      watchLogger.debug("register recursive watcher", { watchedRoot });
      return watch(watchedRoot, { recursive: true }, (eventType, filename) => {
        watchLogger.debug("filesystem event", {
          watchedRoot,
          eventType,
          filename: String(filename ?? ""),
        });
        this.queueRescan(watchedRoot, onSkillsChanged);
      });
    } catch {
      // Recursive watch isn't supported on this platform (typically older Linux kernels).
      // Walk the tree synchronously and wire per-directory watchers before returning, so no
      // filesystem events are missed between `watch()` resolving and the first rescan.
      const nestedWatchers: Array<{ close: () => void }> = [];
      const register = async (dirPath: string) => {
        nestedWatchers.push(
          watch(dirPath, (eventType, filename) => {
            watchLogger.debug("filesystem event", {
              watchedRoot,
              dirPath,
              eventType,
              filename: String(filename ?? ""),
              rebuildWatchers: true,
            });
            this.queueRescan(watchedRoot, onSkillsChanged, true);
          })
        );
        const dirents = await readdir(dirPath, { withFileTypes: true });
        for (const dirent of dirents) {
          if (!dirent.isDirectory() || SKIP_DIRECTORIES.has(dirent.name)) continue;
          await register(path.join(dirPath, dirent.name));
        }
      };
      try {
        watchLogger.debug("register nested watchers", { watchedRoot });
        await register(watchedRoot);
      } catch (error) {
        logger.error(`Failed to register watchers for ${watchedRoot}.`, error);
      }
      return {
        close() {
          for (const watcher of nestedWatchers) watcher.close();
        },
      };
    }
  }

  private queueRescan(
    root: string,
    onSkillsChanged: (libraryItems: LibraryItemSummary[], reason: string) => void,
    rebuildWatchers = false
  ) {
    this.pendingRescanRoots.add(root);
    if (rebuildWatchers) this.pendingRescanRebuild = true;
    if (this.rescanTimer) clearTimeout(this.rescanTimer);
    this.rescanTimer = setTimeout(async () => {
      const reasons = Array.from(this.pendingRescanRoots).sort();
      const shouldRebuild = this.pendingRescanRebuild;
      this.pendingRescanRoots.clear();
      this.pendingRescanRebuild = false;
      this.rescanTimer = null;
      // Skip watcher-triggered scans that are echoes of our own recent writes.
      // Targeted rescan paths already synced in-memory state; `scanAll()` would be
      // pure waste (~500ms on 2k items). Rebuild requests must still be honoured.
      if (!shouldRebuild && this.isInsideLocalMutationEcho()) {
        watchLogger.debug("skip rescan for local mutation echo", { reasons });
        return;
      }
      try {
        if (shouldRebuild) {
          watchLogger.debug("rebuild watchers after filesystem event", { reasons });
          await this.watch(onSkillsChanged);
        }
        watchLogger.debug("run rescan after filesystem event", { reasons });
        const libraryItems = await this.scanAll();
        onSkillsChanged(libraryItems, `filesystem:${reasons.join(",")}`);
      } catch (error) {
        logger.error("Failed to rescan library items.", error);
      }
    }, 150);
  }

  stopWatching() {
    for (const watcher of this.watchers) watcher.close();
    this.watchers = [];
  }
}
