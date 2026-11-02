import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { GitLibraryConfig } from "../../shared/types";
import {
  discardGitLibraryChanges,
  pushGitLibraryChanges,
  readGitLibraryStatus,
  sshHost,
  syncGitLibrary,
} from "./libraries";

const run = promisify(execFile);

let tmpRoot: string;

async function git(args: string[], cwd?: string) {
  return run("git", args, {
    cwd,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  });
}

async function createRemote(files: Record<string, string>) {
  const sourcePath = path.join(tmpRoot, `source-${Math.random().toString(36).slice(2)}`);
  const remotePath = path.join(tmpRoot, `remote-${Math.random().toString(36).slice(2)}.git`);
  await mkdir(sourcePath, { recursive: true });
  await git(["init", "--initial-branch", "main"], sourcePath);
  await git(["config", "user.name", "Test Library"], sourcePath);
  await git(["config", "user.email", "test@example.invalid"], sourcePath);

  for (const [relativePath, content] of Object.entries(files)) {
    const filePath = path.join(sourcePath, relativePath);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, content, "utf8");
  }

  await git(["add", "--all"], sourcePath);
  await git(["commit", "-m", "Seed library"], sourcePath);
  await git(["init", "--bare", remotePath]);
  await git(["remote", "add", "origin", remotePath], sourcePath);
  await git(["push", "-u", "origin", "HEAD:main"], sourcePath);
  return { remotePath, sourcePath };
}

function library(remoteUrl: string, overrides: Partial<GitLibraryConfig> = {}): GitLibraryConfig {
  return {
    id: "library-1",
    name: "Team skills",
    remoteUrl,
    branch: "main",
    path: "",
    syncMode: "pull",
    autoSync: false,
    syncIntervalMinutes: 60,
    readOnly: false,
    ...overrides,
  };
}

beforeEach(async () => {
  tmpRoot = await mkdtemp(path.join(tmpdir(), "skillful-git-library-"));
});

afterEach(async () => {
  await rm(tmpRoot, { recursive: true, force: true });
});

describe("sshHost", () => {
  it("reads the host from scp-style remotes", () => {
    expect(sshHost("git@github.com:you/skills.git")).toBe("github.com");
  });

  it("reads the host from ssh:// remotes", () => {
    expect(sshHost("ssh://git@git.example.com:2222/you/skills.git")).toBe("git.example.com");
  });

  it("returns null for https remotes", () => {
    expect(sshHost("https://github.com/you/skills.git")).toBeNull();
  });
});

describe("syncGitLibrary", () => {
  it("clones a library that has not been cloned yet", async () => {
    const { remotePath } = await createRemote({ "review-pr/SKILL.md": "# Review PR\n" });
    const targetPath = path.join(tmpRoot, "clone");

    const result = await syncGitLibrary(library(remotePath), targetPath);

    expect(result.cloned).toBe(true);
    expect(result.state).toBe("up-to-date");
    await expect(readFile(path.join(targetPath, "review-pr", "SKILL.md"), "utf8")).resolves.toBe(
      "# Review PR\n"
    );
  });

  it("fast-forwards an existing clone when the remote moved ahead", async () => {
    const { remotePath, sourcePath } = await createRemote({ "review-pr/SKILL.md": "# v1\n" });
    const targetPath = path.join(tmpRoot, "clone");
    await syncGitLibrary(library(remotePath), targetPath);

    await writeFile(path.join(sourcePath, "review-pr", "SKILL.md"), "# v2\n", "utf8");
    await git(["commit", "-am", "Update"], sourcePath);
    await git(["push", "origin", "HEAD:main"], sourcePath);

    const result = await syncGitLibrary(library(remotePath), targetPath);

    expect(result.state).toBe("updated");
    expect(result.pulled).toBe(true);
    await expect(readFile(path.join(targetPath, "review-pr", "SKILL.md"), "utf8")).resolves.toBe(
      "# v2\n"
    );
  });

  it("reports local edits in pull mode instead of overwriting them", async () => {
    const { remotePath } = await createRemote({ "review-pr/SKILL.md": "# v1\n" });
    const targetPath = path.join(tmpRoot, "clone");
    await syncGitLibrary(library(remotePath), targetPath);
    await writeFile(path.join(targetPath, "review-pr", "SKILL.md"), "# local\n", "utf8");

    const result = await syncGitLibrary(library(remotePath), targetPath);

    expect(result.state).toBe("local-changes");
    expect(result.pushed).toBe(false);
    expect(result.localChanges.map((change) => change.relativePath)).toContain(
      "review-pr/SKILL.md"
    );
    await expect(readFile(path.join(targetPath, "review-pr", "SKILL.md"), "utf8")).resolves.toBe(
      "# local\n"
    );
  });

  it("commits and pushes local edits in two-way mode", async () => {
    const { remotePath } = await createRemote({ "review-pr/SKILL.md": "# v1\n" });
    const targetPath = path.join(tmpRoot, "clone");
    await syncGitLibrary(library(remotePath, { syncMode: "two-way" }), targetPath);
    await writeFile(path.join(targetPath, "review-pr", "SKILL.md"), "# local\n", "utf8");

    const result = await syncGitLibrary(library(remotePath, { syncMode: "two-way" }), targetPath);

    expect(result.pushed).toBe(true);
    const remoteContent = await git(["--git-dir", remotePath, "show", "main:review-pr/SKILL.md"]);
    expect(remoteContent.stdout).toBe("# local\n");
  });

  it("rejects remotes that use a git transport helper", async () => {
    const result = await syncGitLibrary(
      library('ext::sh -c "touch /tmp/pwned"'),
      path.join(tmpRoot, "clone")
    );

    expect(result.state).toBe("error");
    expect(result.message).toContain("unsupported git transport helper");
  });
});

describe("pushGitLibraryChanges", () => {
  it("pushes local edits from a pull-mode library on demand", async () => {
    const { remotePath } = await createRemote({ "review-pr/SKILL.md": "# v1\n" });
    const targetPath = path.join(tmpRoot, "clone");
    await syncGitLibrary(library(remotePath), targetPath);
    await writeFile(path.join(targetPath, "review-pr", "SKILL.md"), "# local\n", "utf8");

    const result = await pushGitLibraryChanges(library(remotePath), targetPath);

    expect(result.pushed).toBe(true);
    const remoteContent = await git(["--git-dir", remotePath, "show", "main:review-pr/SKILL.md"]);
    expect(remoteContent.stdout).toBe("# local\n");
  });
});

describe("discardGitLibraryChanges", () => {
  it("restores the working tree to the remote branch", async () => {
    const { remotePath } = await createRemote({ "review-pr/SKILL.md": "# v1\n" });
    const targetPath = path.join(tmpRoot, "clone");
    await syncGitLibrary(library(remotePath), targetPath);
    await writeFile(path.join(targetPath, "review-pr", "SKILL.md"), "# local\n", "utf8");
    await writeFile(path.join(targetPath, "stray.md"), "stray\n", "utf8");

    const result = await discardGitLibraryChanges(library(remotePath), targetPath);

    expect(result.state).toBe("up-to-date");
    await expect(readFile(path.join(targetPath, "review-pr", "SKILL.md"), "utf8")).resolves.toBe(
      "# v1\n"
    );
    await expect(readFile(path.join(targetPath, "stray.md"), "utf8")).rejects.toThrow();
  });
});

describe("readGitLibraryStatus", () => {
  it("reports a library that has never been cloned", async () => {
    const result = await readGitLibraryStatus(
      library("git@example.com:you/skills.git"),
      path.join(tmpRoot, "missing")
    );

    expect(result.state).toBe("not-cloned");
  });

  it("reports local changes without contacting the remote", async () => {
    const { remotePath } = await createRemote({ "review-pr/SKILL.md": "# v1\n" });
    const targetPath = path.join(tmpRoot, "clone");
    await syncGitLibrary(library(remotePath), targetPath);
    await writeFile(path.join(targetPath, "review-pr", "SKILL.md"), "# local\n", "utf8");

    const result = await readGitLibraryStatus(library(remotePath), targetPath);

    expect(result.state).toBe("local-changes");
    expect(result.localChanges).toHaveLength(1);
  });
});
