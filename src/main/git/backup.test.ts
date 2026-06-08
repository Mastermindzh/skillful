import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AppError } from "../../shared/errors";
import type { AppConfig } from "../../shared/types";
import {
  defaultAppConfig,
  defaultGitBackupConfig,
  persistSettings,
  settingsDirectory,
} from "../settings";
import { initializeGitBackup, restoreGitBackup, runGitBackup } from "./backup";

const run = promisify(execFile);

let tmpRoot: string;
let originalXdg: string | undefined;
let originalHome: string | undefined;
let originalAppData: string | undefined;
let originalConfigName: string | undefined;

async function git(args: string[], cwd?: string) {
  return run("git", args, {
    cwd,
    env: {
      ...process.env,
      GIT_TERMINAL_PROMPT: "0",
    },
  });
}

async function bareGit(gitDir: string, args: string[]) {
  return git(["--git-dir", gitDir, ...args]);
}

function appConfig(remoteUrl: string): AppConfig {
  return {
    ...defaultAppConfig(),
    scanRoots: [],
    onboardingTourCompleted: true,
    gitBackup: {
      ...defaultGitBackupConfig(),
      enabled: true,
      remoteUrl,
      branch: "main",
    },
  };
}

async function createRemoteBackup(files: Record<string, string>) {
  const sourcePath = path.join(tmpRoot, `source-${Math.random().toString(36).slice(2)}`);
  const remotePath = path.join(tmpRoot, `remote-${Math.random().toString(36).slice(2)}.git`);
  await mkdir(sourcePath, { recursive: true });
  await git(["init"], sourcePath);
  await git(["config", "user.name", "Test Backup"], sourcePath);
  await git(["config", "user.email", "test@example.invalid"], sourcePath);

  for (const [relativePath, content] of Object.entries(files)) {
    const filePath = path.join(sourcePath, relativePath);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, content, "utf8");
  }

  await git(["add", "--all"], sourcePath);
  await git(["commit", "-m", "Seed backup"], sourcePath);
  await git(["init", "--bare", remotePath]);
  await git(["remote", "add", "origin", remotePath], sourcePath);
  await git(["push", "-u", "origin", "HEAD:main"], sourcePath);
  return remotePath;
}

beforeEach(async () => {
  tmpRoot = await mkdtemp(path.join(tmpdir(), "skillful-git-backup-"));
  originalXdg = process.env.XDG_CONFIG_HOME;
  originalHome = process.env.HOME;
  originalAppData = process.env.APPDATA;
  originalConfigName = process.env.SKILLFUL_CONFIG_NAME;
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

describe("runGitBackup", () => {
  it("tests remote access without initializing the config directory repository", async () => {
    const remotePath = path.join(tmpRoot, "remote.git");
    const config = appConfig(remotePath);
    await git(["init", "--bare", remotePath]);

    const result = await initializeGitBackup(config.gitBackup);

    expect(result).toMatchObject({ state: "ready", changed: false, pushed: false });
    await expect(stat(path.join(settingsDirectory(), ".git"))).rejects.toThrow();
  });

  it("backs up settings and the default library to a git remote", async () => {
    const remotePath = path.join(tmpRoot, "remote.git");
    const config = appConfig(remotePath);
    await git(["init", "--bare", remotePath]);
    await persistSettings(config);

    const skillPath = path.join(settingsDirectory(), "skills", "Work", "review-pr");
    const agentPath = path.join(settingsDirectory(), "agents", "Work", "release-triage");
    await mkdir(skillPath, { recursive: true });
    await mkdir(agentPath, { recursive: true });
    await mkdir(path.join(settingsDirectory(), "electron"), { recursive: true });
    await writeFile(path.join(skillPath, "SKILL.md"), "# Review PR\n", "utf8");
    await writeFile(path.join(agentPath, "AGENT.md"), "# Release Triage\n", "utf8");
    await writeFile(path.join(settingsDirectory(), "scan-index.json"), "{}", "utf8");
    await writeFile(path.join(settingsDirectory(), "electron", "state.json"), "{}", "utf8");

    const result = await runGitBackup(config);

    expect(result).toMatchObject({ state: "ready", changed: true, pushed: true });
    await expect(
      readFile(path.join(settingsDirectory(), "settings.json"), "utf8")
    ).resolves.toContain("gitBackup");
    await expect(
      readFile(path.join(settingsDirectory(), "skills", "Work", "review-pr", "SKILL.md"), "utf8")
    ).resolves.toBe("# Review PR\n");
    await expect(
      readFile(
        path.join(settingsDirectory(), "agents", "Work", "release-triage", "AGENT.md"),
        "utf8"
      )
    ).resolves.toBe("# Release Triage\n");

    const pushedSettings = await bareGit(remotePath, ["show", "main:settings.json"]);
    const pushedSkill = await bareGit(remotePath, ["show", "main:skills/Work/review-pr/SKILL.md"]);
    const pushedAgent = await bareGit(remotePath, [
      "show",
      "main:agents/Work/release-triage/AGENT.md",
    ]);
    await expect(bareGit(remotePath, ["show", "main:backup-manifest.json"])).rejects.toThrow();
    await expect(bareGit(remotePath, ["show", "main:library"])).rejects.toThrow();
    await expect(bareGit(remotePath, ["show", "main:scan-index.json"])).rejects.toThrow();
    await expect(bareGit(remotePath, ["show", "main:electron/state.json"])).rejects.toThrow();
    expect(pushedSettings.stdout).toContain("gitBackup");
    expect(pushedSkill.stdout).toBe("# Review PR\n");
    expect(pushedAgent.stdout).toBe("# Release Triage\n");
  });

  it("does not create a second commit when nothing changed", async () => {
    const remotePath = path.join(tmpRoot, "remote.git");
    const config = appConfig(remotePath);
    await git(["init", "--bare", remotePath]);
    await persistSettings(config);

    const skillPath = path.join(settingsDirectory(), "skills", "Work", "review-pr");
    await mkdir(skillPath, { recursive: true });
    await writeFile(path.join(skillPath, "SKILL.md"), "# Review PR\n", "utf8");

    const first = await runGitBackup(config);
    const firstHead = await git(["rev-parse", "HEAD"], settingsDirectory());
    const second = await runGitBackup(config);
    const secondHead = await git(["rev-parse", "HEAD"], settingsDirectory());

    expect(first.changed).toBe(true);
    expect(second).toMatchObject({ state: "up-to-date", changed: false, pushed: false });
    expect(secondHead.stdout).toBe(firstHead.stdout);
  });

  it("restores an existing backup into an empty config directory", async () => {
    const remotePath = await createRemoteBackup({
      ".gitignore": [
        "# Skillful git backup repository",
        "*",
        "!/.gitignore",
        "!/settings.json",
        "!/skills/",
        "!/skills/**",
        "",
      ].join("\n"),
      "settings.json": JSON.stringify({ scanRoots: [], tools: [], toolMappings: [] }),
      "skills/Work/review-pr/SKILL.md": "# Review PR\n",
    });
    const config = appConfig(remotePath);

    const result = await restoreGitBackup(config.gitBackup, "safe");

    expect(result).toMatchObject({ state: "ready", restored: true, localContentFound: false });
    await expect(
      readFile(path.join(settingsDirectory(), "skills", "Work", "review-pr", "SKILL.md"), "utf8")
    ).resolves.toBe("# Review PR\n");
    await expect(readFile(path.join(settingsDirectory(), "settings.json"), "utf8")).resolves.toBe(
      JSON.stringify({ scanRoots: [], tools: [], toolMappings: [] })
    );
  });

  it("keeps restored files when restoring again into the same backup repository", async () => {
    const remotePath = await createRemoteBackup({
      ".gitignore": [
        "# Skillful git backup repository",
        "*",
        "!/.gitignore",
        "!/settings.json",
        "!/skills/",
        "!/skills/**",
        "!/agents/",
        "!/agents/**",
        "",
      ].join("\n"),
      "settings.json": JSON.stringify({ scanRoots: [], tools: [], toolMappings: [] }),
      "skills/Work/review-pr/SKILL.md": "# Review PR\n",
      "agents/Work/release-triage/AGENT.md": "# Release Triage\n",
    });
    const config = appConfig(remotePath);

    await restoreGitBackup(config.gitBackup, "safe");
    const result = await restoreGitBackup(config.gitBackup, "replace");

    expect(result).toMatchObject({ state: "ready", restored: true });
    await expect(
      readFile(path.join(settingsDirectory(), "skills", "Work", "review-pr", "SKILL.md"), "utf8")
    ).resolves.toBe("# Review PR\n");
    await expect(
      readFile(
        path.join(settingsDirectory(), "agents", "Work", "release-triage", "AGENT.md"),
        "utf8"
      )
    ).resolves.toBe("# Release Triage\n");
  });

  it("refuses to restore over local library content until replacement is confirmed", async () => {
    const remotePath = await createRemoteBackup({
      ".gitignore": [
        "# Skillful git backup repository",
        "*",
        "!/.gitignore",
        "!/skills/",
        "!/skills/**",
        "",
      ].join("\n"),
      "skills/Remote/review-pr/SKILL.md": "# Remote Review PR\n",
    });
    const config = appConfig(remotePath);
    const localSkillPath = path.join(settingsDirectory(), "skills", "Local", "local-skill");
    await mkdir(localSkillPath, { recursive: true });
    await writeFile(path.join(localSkillPath, "SKILL.md"), "# Local Skill\n", "utf8");

    await expect(restoreGitBackup(config.gitBackup, "safe")).rejects.toMatchObject({
      code: "git-restore-local-content" satisfies AppError["code"],
    });
    await expect(readFile(path.join(localSkillPath, "SKILL.md"), "utf8")).resolves.toBe(
      "# Local Skill\n"
    );

    const result = await restoreGitBackup(config.gitBackup, "replace");

    expect(result).toMatchObject({ state: "ready", restored: true, localContentFound: true });
    await expect(readFile(path.join(localSkillPath, "SKILL.md"), "utf8")).rejects.toThrow();
    await expect(
      readFile(path.join(settingsDirectory(), "skills", "Remote", "review-pr", "SKILL.md"), "utf8")
    ).resolves.toBe("# Remote Review PR\n");
  });
});
