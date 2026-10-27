import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppError } from "../shared/errors";
import type { GitLibraryConfig } from "../shared/types";
import {
  defaultGitBackupConfig,
  defaultGitLibraryRoot,
  effectiveScanRoots,
  gitLibraryPath,
  loadSavedSettings,
  normalizeGitLibraries,
  normalizeToolConfigs,
  persistSettings,
  settingsDirectory,
} from "./settings";

/**
 * These tests exercise the corrupt-vs-missing branches of `loadSavedSettings` by
 * pointing the settings directory at a tmp dir via `XDG_CONFIG_HOME` / `APPDATA` /
 * `HOME`. See `settingsDirectory()` for the env vars it honors per platform.
 */

let tmpRoot: string;
let originalXdg: string | undefined;
let originalHome: string | undefined;
let originalAppData: string | undefined;
let originalConfigName: string | undefined;

function settingsFile() {
  return path.join(settingsDirectory(), "settings.json");
}

beforeEach(async () => {
  tmpRoot = await mkdtemp(path.join(tmpdir(), "skillful-settings-"));
  originalXdg = process.env.XDG_CONFIG_HOME;
  originalHome = process.env.HOME;
  originalAppData = process.env.APPDATA;
  originalConfigName = process.env.SKILLFUL_CONFIG_NAME;
  // Redirect Linux + macOS fallback + Windows to the tmp dir.
  process.env.XDG_CONFIG_HOME = tmpRoot;
  process.env.HOME = tmpRoot;
  process.env.APPDATA = tmpRoot;
  delete process.env.SKILLFUL_CONFIG_NAME;
  await mkdir(settingsDirectory(), { recursive: true });
});

afterEach(async () => {
  if (originalXdg === undefined) delete process.env.XDG_CONFIG_HOME;
  else process.env.XDG_CONFIG_HOME = originalXdg;
  if (originalHome === undefined) delete process.env.HOME;
  else process.env.HOME = originalHome;
  if (originalAppData === undefined) delete process.env.APPDATA;
  else process.env.APPDATA = originalAppData;
  if (originalConfigName === undefined) delete process.env.SKILLFUL_CONFIG_NAME;
  else process.env.SKILLFUL_CONFIG_NAME = originalConfigName;
  await rm(tmpRoot, { recursive: true, force: true });
});

describe("loadSavedSettings", () => {
  it("returns null when the settings file does not exist (ENOENT)", async () => {
    await expect(loadSavedSettings()).resolves.toBeNull();
  });

  it("throws AppError('settings-corrupt') on invalid JSON", async () => {
    await writeFile(settingsFile(), "{ not valid json", "utf8");
    await expect(loadSavedSettings()).rejects.toMatchObject({
      name: "AppError",
      code: "settings-corrupt",
    });
  });

  it("throws AppError('settings-corrupt') on valid JSON that fails schema validation", async () => {
    // scanRoots should be an array of strings; number makes the schema reject it.
    await writeFile(
      settingsFile(),
      JSON.stringify({ scanRoots: 123, tools: [], toolMappings: [] }),
      "utf8"
    );
    await expect(loadSavedSettings()).rejects.toMatchObject({
      name: "AppError",
      code: "settings-corrupt",
    });
  });

  it("loads a valid empty settings file", async () => {
    await writeFile(
      settingsFile(),
      JSON.stringify({ scanRoots: [], tools: [], toolMappings: [] }),
      "utf8"
    );
    const loaded = await loadSavedSettings();
    expect(loaded).toEqual({
      scanRoots: [],
      tools: [],
      toolMappings: [],
      suppressSuccessNotifications: false,
      minimizeToTrayOnClose: false,
      language: "system",
      defaultEditorMode: "preview",
      onboardingTourCompleted: false,
      gitBackup: defaultGitBackupConfig(),
      gitLibraries: [],
    });
  });

  it("persists settings through electron-store and loads them back", async () => {
    const libraryRoot = path.join(tmpRoot, "library");
    const codexRoot = path.join(tmpRoot, "codex", "skills");

    await persistSettings({
      scanRoots: [libraryRoot],
      tools: [
        {
          id: "codex",
          name: "Codex",
          installRoots: {
            skill: [codexRoot],
            agent: [],
          },
        },
      ],
      toolMappings: [{ itemId: "review-pr", toolIds: ["codex"] }],
      suppressSuccessNotifications: true,
      minimizeToTrayOnClose: true,
      language: "nl",
      defaultEditorMode: "edit",
      onboardingTourCompleted: true,
      gitBackup: {
        ...defaultGitBackupConfig(),
        enabled: true,
        remoteUrl: "git@example.com:me/skillful-backup.git",
      },
      gitLibraries: [],
    });

    await expect(loadSavedSettings()).resolves.toEqual({
      scanRoots: [libraryRoot],
      tools: [
        {
          id: "codex",
          name: "Codex",
          installRoots: {
            skill: [codexRoot],
            agent: [],
          },
        },
      ],
      toolMappings: [{ itemId: "review-pr", toolIds: ["codex"] }],
      suppressSuccessNotifications: true,
      minimizeToTrayOnClose: true,
      language: "nl",
      defaultEditorMode: "edit",
      onboardingTourCompleted: true,
      gitBackup: {
        ...defaultGitBackupConfig(),
        enabled: true,
        remoteUrl: "git@example.com:me/skillful-backup.git",
      },
      gitLibraries: [],
    });
  });

  it("attaches the settings file path to the thrown AppError", async () => {
    await writeFile(settingsFile(), "{ broken", "utf8");
    try {
      await loadSavedSettings();
      throw new Error("expected loadSavedSettings to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).details?.path).toBe(settingsFile());
    }
  });
});

describe("settingsDirectory", () => {
  it("uses a custom config directory name when SKILLFUL_CONFIG_NAME is set", () => {
    process.env.SKILLFUL_CONFIG_NAME = "skillful-dev";
    expect(settingsDirectory()).toBe(
      process.platform === "darwin"
        ? path.join(tmpRoot, "Library", "Application Support", "skillful-dev")
        : path.join(tmpRoot, "skillful-dev")
    );
  });
});

describe("normalizeToolConfigs", () => {
  it("allows a tool to use the same install folder for skills and agents", () => {
    expect(
      normalizeToolConfigs([
        {
          id: "opencode",
          name: "opencode",
          installRoots: {
            skill: ["/home/test/.config/opencode/skills"],
            agent: ["/home/test/.config/opencode/skills"],
          },
        },
      ])
    ).toEqual([
      {
        id: "opencode",
        name: "opencode",
        installRoots: {
          skill: ["/home/test/.config/opencode/skills"],
          agent: ["/home/test/.config/opencode/skills"],
        },
      },
    ]);
  });
});

describe("git libraries", () => {
  function library(overrides: Partial<GitLibraryConfig> = {}): GitLibraryConfig {
    return {
      id: "library-1",
      name: "Team skills",
      remoteUrl: "git@example.com:me/skills.git",
      branch: "main",
      path: "",
      syncMode: "pull",
      autoSync: true,
      syncIntervalMinutes: 60,
      readOnly: false,
      ...overrides,
    };
  }

  it("clones into a managed folder keyed by library id when no path is set", () => {
    expect(gitLibraryPath(library())).toBe(path.join(defaultGitLibraryRoot(), "library-1"));
  });

  it("honours an explicit clone folder", () => {
    expect(gitLibraryPath(library({ path: "/srv/skills" }))).toBe("/srv/skills");
  });

  it("adds every git library clone to the effective scan roots", () => {
    const roots = effectiveScanRoots([], [library({ path: "/srv/skills" })]);

    expect(roots).toContain("/srv/skills");
    expect(roots).toContain(settingsDirectory());
  });

  it("drops libraries without a remote", () => {
    expect(normalizeGitLibraries([library({ remoteUrl: "  " })])).toEqual([]);
  });

  it("clamps the sync interval to at least one minute", () => {
    expect(
      normalizeGitLibraries([library({ syncIntervalMinutes: 0 })])[0]?.syncIntervalMinutes
    ).toBe(1);
  });

  it("rejects duplicate library ids", () => {
    expect(() => normalizeGitLibraries([library(), library()])).toThrow(AppError);
  });

  it("rejects two libraries sharing a clone folder", () => {
    expect(() =>
      normalizeGitLibraries([
        library({ id: "a", path: "/srv/skills" }),
        library({ id: "b", path: "/srv/skills" }),
      ])
    ).toThrow(AppError);
  });

  it("rejects a relative clone folder", () => {
    expect(() => normalizeGitLibraries([library({ path: "relative/path" })])).toThrow(AppError);
  });

  it("rejects a branch with whitespace", () => {
    expect(() => normalizeGitLibraries([library({ branch: "my branch" })])).toThrow(AppError);
  });
});
