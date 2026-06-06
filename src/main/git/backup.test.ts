import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AppConfig } from "../../shared/types";
import {
  defaultAppConfig,
  defaultGitBackupConfig,
  persistSettings,
  settingsDirectory,
} from "../settings";
import { initializeGitBackup, runGitBackup } from "./backup";

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

function appConfig(repositoryPath: string, remoteUrl: string): AppConfig {
  return {
    ...defaultAppConfig(),
    scanRoots: [],
    onboardingTourCompleted: true,
    gitBackup: {
      ...defaultGitBackupConfig(),
      enabled: true,
      repositoryPath,
      remoteUrl,
      branch: "main",
    },
  };
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
  it("tests remote access without initializing the local backup repository", async () => {
    const repositoryPath = path.join(tmpRoot, "backup-repo");
    const remotePath = path.join(tmpRoot, "remote.git");
    const config = appConfig(repositoryPath, remotePath);
    await git(["init", "--bare", remotePath]);

    const result = await initializeGitBackup(config.gitBackup);

    expect(result).toMatchObject({ state: "ready", changed: false, pushed: false });
    await expect(readFile(path.join(repositoryPath, ".git"), "utf8")).rejects.toThrow();
  });

  it("backs up settings and the default library to a git remote", async () => {
    const repositoryPath = path.join(tmpRoot, "backup-repo");
    const remotePath = path.join(tmpRoot, "remote.git");
    const config = appConfig(repositoryPath, remotePath);
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
    await expect(readFile(path.join(repositoryPath, "settings.json"), "utf8")).resolves.toContain(
      "gitBackup"
    );
    await expect(
      readFile(path.join(repositoryPath, "skills", "Work", "review-pr", "SKILL.md"), "utf8")
    ).resolves.toBe("# Review PR\n");
    await expect(
      readFile(path.join(repositoryPath, "agents", "Work", "release-triage", "AGENT.md"), "utf8")
    ).resolves.toBe("# Release Triage\n");
    await expect(
      readFile(path.join(repositoryPath, "backup-manifest.json"), "utf8")
    ).rejects.toThrow();
    await expect(readFile(path.join(repositoryPath, "library"), "utf8")).rejects.toThrow();
    await expect(readFile(path.join(repositoryPath, "scan-index.json"), "utf8")).rejects.toThrow();
    await expect(
      readFile(path.join(repositoryPath, "electron", "state.json"), "utf8")
    ).rejects.toThrow();

    const pushedSkill = await git(["show", "main:skills/Work/review-pr/SKILL.md"], remotePath);
    expect(pushedSkill.stdout).toBe("# Review PR\n");
  });

  it("does not create a second commit when nothing changed", async () => {
    const repositoryPath = path.join(tmpRoot, "backup-repo");
    const remotePath = path.join(tmpRoot, "remote.git");
    const config = appConfig(repositoryPath, remotePath);
    await git(["init", "--bare", remotePath]);
    await persistSettings(config);

    const skillPath = path.join(settingsDirectory(), "skills", "Work", "review-pr");
    await mkdir(skillPath, { recursive: true });
    await writeFile(path.join(skillPath, "SKILL.md"), "# Review PR\n", "utf8");

    const first = await runGitBackup(config);
    const firstHead = await git(["rev-parse", "HEAD"], repositoryPath);
    const second = await runGitBackup(config);
    const secondHead = await git(["rev-parse", "HEAD"], repositoryPath);

    expect(first.changed).toBe(true);
    expect(second).toMatchObject({ state: "up-to-date", changed: false, pushed: false });
    expect(secondHead.stdout).toBe(firstHead.stdout);
  });
});
