import { homedir } from "node:os";
import path from "node:path";
import type { Options as ElectronStoreOptions } from "electron-store";
import { AppError } from "../shared/errors";
import { LIBRARY_ITEM_KINDS } from "../shared/library";
import { AppConfigSchema } from "../shared/schemas";
import { presetToolConfig, TOOL_PRESETS } from "../shared/toolPresets";
import type {
  AppConfig,
  AppSettings,
  GitBackupConfig,
  LibraryItemKind,
  LibraryItemToolMapping,
  ToolConfig,
} from "../shared/types";
import { normalizeAbsolutePathList, pathExists, resolvePathList } from "./fs";

const SETTINGS_FILE_NAME = "settings.json";
const SETTINGS_STORE_NAME = "settings";
const SETTINGS_STORE_VERSION = "1.0.0";
const DEFAULT_SETTINGS_DIRECTORY_NAME = "skillful";

type SettingsStoreData = AppConfig;
type SettingsStoreOptions = ElectronStoreOptions<SettingsStoreData> & {
  projectVersion: string;
};

function settingsDirectoryName() {
  return process.env.SKILLFUL_CONFIG_NAME?.trim() || DEFAULT_SETTINGS_DIRECTORY_NAME;
}

export function defaultGitBackupConfig(): GitBackupConfig {
  return {
    enabled: false,
    remoteUrl: "",
    branch: "main",
    includeSettings: true,
    includeDefaultLibrary: true,
    autoBackup: false,
    autoBackupIntervalMinutes: 10,
  };
}

/** Returns the directory where Skillful keeps settings and the default skill library. */
export function settingsDirectory() {
  switch (process.platform) {
    case "darwin":
      return path.join(homedir(), "Library", "Application Support", settingsDirectoryName());
    case "win32":
      return path.join(
        process.env.APPDATA || path.join(homedir(), "AppData", "Roaming"),
        settingsDirectoryName()
      );
    default:
      return path.join(
        process.env.XDG_CONFIG_HOME || path.join(homedir(), ".config"),
        settingsDirectoryName()
      );
  }
}

export function defaultSkillRoot() {
  return settingsDirectory();
}

/** Combines the default skill library with user-configured extra scan roots. */
export function effectiveScanRoots(customRoots: string[]) {
  return Array.from(new Set([defaultSkillRoot(), ...customRoots]));
}

export function defaultAppConfig(scanRoots: string[] = []): AppConfig {
  return {
    scanRoots: scanRoots.length > 0 ? normalizeConfiguredScanRoots(scanRoots) : [],
    tools: [],
    toolMappings: [],
    suppressSuccessNotifications: false,
    minimizeToTrayOnClose: false,
    language: "system",
    defaultEditorMode: "preview",
    onboardingTourCompleted: false,
    gitBackup: defaultGitBackupConfig(),
  };
}

function resolveSavedScanRoots(scanRoots: string[]) {
  return resolvePathList(scanRoots);
}

export function normalizeConfiguredScanRoots(scanRoots: string[]) {
  return normalizeAbsolutePathList(scanRoots, "Scan folders");
}

function normalizeToolName(value: string) {
  return value.trim();
}

function emptyInstallRoots(): Record<LibraryItemKind, string[]> {
  return { skill: [], agent: [] };
}

function normalizeToolInstallRoots(tool: ToolConfig | { installRoots?: unknown }) {
  const rawRoots = tool.installRoots;

  if (Array.isArray(rawRoots)) {
    return {
      skill: normalizeConfiguredScanRoots(rawRoots),
      agent: [],
    };
  }

  if (rawRoots && typeof rawRoots === "object") {
    const roots = rawRoots as Partial<Record<LibraryItemKind, unknown>>;
    return {
      skill: Array.isArray(roots.skill) ? normalizeConfiguredScanRoots(roots.skill) : [],
      agent: Array.isArray(roots.agent) ? normalizeConfiguredScanRoots(roots.agent) : [],
    };
  }

  return emptyInstallRoots();
}

function flatInstallRoots(tool: ToolConfig) {
  return [...tool.installRoots.skill, ...tool.installRoots.agent];
}

/**
 * Normalizes persisted tool config and enforces the invariants the install layer depends on:
 * stable ids and unique names. Install folders may overlap because some tools intentionally
 * use the same destination for skills and agents.
 */
export function normalizeToolConfigs(tools: ToolConfig[]) {
  const toolIds = new Set<string>();
  const toolNames = new Set<string>();

  return tools
    .map((tool) => ({
      id: tool.id.trim(),
      name: normalizeToolName(tool.name),
      installRoots: normalizeToolInstallRoots(tool),
    }))
    .filter((tool) => tool.id && tool.name && flatInstallRoots(tool).length > 0)
    .map((tool) => {
      const duplicateId = toolIds.has(tool.id);
      if (duplicateId) throw new AppError("invalid-name", `Duplicate tool id: ${tool.id}`);
      toolIds.add(tool.id);

      const normalizedName = tool.name.toLowerCase();
      if (toolNames.has(normalizedName)) {
        throw new AppError("invalid-name", `Duplicate tool name: ${tool.name}`);
      }
      toolNames.add(normalizedName);

      return tool;
    });
}

export function normalizeToolMappings(mappings: LibraryItemToolMapping[], tools: ToolConfig[]) {
  const validToolIds = new Set(tools.map((tool) => tool.id));

  return mappings
    .map((mapping) => ({
      itemId: mapping.itemId.trim(),
      toolIds: Array.from(
        new Set(
          mapping.toolIds
            .map((toolId) => toolId.trim())
            .filter((toolId) => validToolIds.has(toolId))
        )
      ),
    }))
    .filter((mapping) => mapping.itemId && mapping.toolIds.length > 0);
}

export function normalizeAppConfig(config: AppConfig): AppConfig {
  const scanRoots = normalizeConfiguredScanRoots(config.scanRoots);
  const tools = normalizeToolConfigs(config.tools);
  return {
    ...config,
    scanRoots,
    tools,
    toolMappings: normalizeToolMappings(config.toolMappings, tools),
  };
}

export function configFilePath() {
  return path.join(settingsDirectory(), SETTINGS_FILE_NAME);
}

function serializedSettings(config: AppConfig): SettingsStoreData {
  return {
    scanRoots: config.scanRoots,
    tools: config.tools,
    toolMappings: config.toolMappings,
    suppressSuccessNotifications: config.suppressSuccessNotifications,
    minimizeToTrayOnClose: config.minimizeToTrayOnClose,
    language: config.language,
    defaultEditorMode: config.defaultEditorMode,
    onboardingTourCompleted: config.onboardingTourCompleted,
    gitBackup: config.gitBackup,
  };
}

async function createSettingsStore() {
  try {
    const { default: ElectronStore } = await import("electron-store");
    const options: SettingsStoreOptions = {
      name: SETTINGS_STORE_NAME,
      cwd: settingsDirectory(),
      projectVersion: SETTINGS_STORE_VERSION,
      clearInvalidConfig: false,
      migrations: {
        ">=1.0.0": () => {},
      },
    };
    return new ElectronStore<SettingsStoreData>(options);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new AppError(
        "settings-corrupt",
        "Settings file contains invalid JSON. Restore a backup or delete the file to reset.",
        { path: configFilePath() }
      );
    }
    throw new AppError("settings-corrupt", "Settings file could not be read.", {
      path: configFilePath(),
    });
  }
}

export async function detectPresetTools() {
  const detectedTools: ToolConfig[] = [];

  for (const preset of TOOL_PRESETS) {
    const config = presetToolConfig(preset, homedir(), process.platform);
    if (flatInstallRoots(config).length === 0) continue;

    const existingRoots = emptyInstallRoots();
    for (const kind of LIBRARY_ITEM_KINDS) {
      for (const installRoot of config.installRoots[kind]) {
        if (await pathExists(installRoot)) {
          existingRoots[kind].push(path.resolve(installRoot));
        }
      }
    }

    if (flatInstallRoots({ ...config, installRoots: existingRoots }).length > 0) {
      detectedTools.push({
        ...config,
        installRoots: existingRoots,
      });
    }
  }

  return detectedTools;
}

export async function loadSavedSettings(): Promise<AppConfig | null> {
  const store = await createSettingsStore();
  const parsed = store.store;

  if (store.size === 0) return null;

  const validated = AppConfigSchema.safeParse(parsed);
  if (!validated.success) {
    throw new AppError(
      "settings-corrupt",
      "Settings file is malformed. Restore a backup or delete the file to reset.",
      { path: store.path, issues: validated.error.issues }
    );
  }

  const scanRoots = resolveSavedScanRoots(validated.data.scanRoots);
  const tools = normalizeToolConfigs(validated.data.tools);
  const toolMappings = normalizeToolMappings(validated.data.toolMappings, tools);
  return {
    scanRoots,
    tools,
    toolMappings,
    suppressSuccessNotifications: validated.data.suppressSuccessNotifications,
    minimizeToTrayOnClose: validated.data.minimizeToTrayOnClose,
    language: validated.data.language,
    defaultEditorMode: validated.data.defaultEditorMode,
    onboardingTourCompleted: validated.data.onboardingTourCompleted,
    gitBackup: validated.data.gitBackup,
  };
}

export async function loadSettingsOrDefaults(): Promise<AppConfig> {
  const savedConfig = await loadSavedSettings();
  if (savedConfig) return savedConfig;

  const config = defaultAppConfig();
  config.tools = await detectPresetTools();
  if (config.tools.length > 0) {
    await persistSettings(config);
  }
  return config;
}

export async function persistSettings(config: AppConfig) {
  const store = await createSettingsStore();
  store.store = serializedSettings(config);
}

export function settingsFromConfig(config: AppConfig): AppSettings {
  return {
    scanRoots: [...config.scanRoots],
    defaultScanRoot: defaultSkillRoot(),
    effectiveScanRoots: effectiveScanRoots(config.scanRoots),
    homeDirectory: homedir(),
    platform: process.platform,
    tools: [...config.tools],
    toolMappings: [...config.toolMappings],
    suppressSuccessNotifications: config.suppressSuccessNotifications,
    minimizeToTrayOnClose: config.minimizeToTrayOnClose,
    language: config.language,
    defaultEditorMode: config.defaultEditorMode,
    onboardingTourCompleted: config.onboardingTourCompleted,
    gitBackup: { ...config.gitBackup },
  };
}
