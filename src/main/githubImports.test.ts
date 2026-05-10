import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { strToU8, zipSync } from "fflate";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppErrorCode } from "../shared/errors";
import { importLibraryCollectionFromGitHub } from "./githubImports";

let tmpRoot: string;

function createFetchResponse(files: Record<string, Uint8Array>) {
  const body = zipSync(files);
  return new Response(Buffer.from(body), {
    status: 200,
    headers: {
      "content-type": "application/zip",
    },
  });
}

async function expectAppError(promise: Promise<unknown>, code: AppErrorCode) {
  await expect(promise).rejects.toMatchObject({ name: "AppError", code });
}

beforeEach(async () => {
  tmpRoot = await mkdtemp(path.join(tmpdir(), "skillful-github-import-"));
});

afterEach(async () => {
  await rm(tmpRoot, { recursive: true, force: true });
});

describe("importLibraryCollectionFromGitHub", () => {
  it("imports a targeted skill path from a GitHub source archive", async () => {
    const fetchStub = vi.fn(async () =>
      createFetchResponse({
        "skillful-library-main/skills/debug-checklist/SKILL.md": strToU8(
          ["---", "name: Debug Checklist", "description: Imported from GitHub", "---"].join("\n")
        ),
        "skillful-library-main/skills/debug-checklist/notes.md": strToU8("# Notes\n"),
        "skillful-library-main/agents/release-triage/AGENT.md": strToU8("# Release Triage\n"),
      })
    );

    const collection = await importLibraryCollectionFromGitHub(
      tmpRoot,
      {
        name: "GitHub Imports",
        repo: "Mastermindzh/skillful-library",
        ref: "main",
        path: "skills/debug-checklist",
      },
      fetchStub as typeof fetch
    );

    expect(collection).toEqual({ id: "GitHub Imports", title: "GitHub Imports" });

    const importedEntryPath = path.join(
      tmpRoot,
      "skills",
      "GitHub Imports",
      "debug-checklist",
      "SKILL.md"
    );
    await expect(stat(importedEntryPath)).resolves.toMatchObject({ isFile: expect.any(Function) });
    await expect(readFile(importedEntryPath, "utf8")).resolves.toContain("Debug Checklist");
    await expect(
      stat(path.join(tmpRoot, "agents", "GitHub Imports", "release-triage", "AGENT.md"))
    ).rejects.toThrow();
  });

  it("imports both skills and agents when scanning the repo root", async () => {
    const fetchStub = vi.fn(async () =>
      createFetchResponse({
        "skillful-library-main/skills/debug-checklist/SKILL.md": strToU8("# Debug Checklist\n"),
        "skillful-library-main/agents/release-triage/AGENT.md": strToU8("# Release Triage\n"),
      })
    );

    await importLibraryCollectionFromGitHub(
      tmpRoot,
      {
        name: "Shared Library",
        repo: "Mastermindzh/skillful-library",
      },
      fetchStub as typeof fetch
    );

    await expect(
      stat(path.join(tmpRoot, "skills", "Shared Library", "debug-checklist", "SKILL.md"))
    ).resolves.toMatchObject({ isFile: expect.any(Function) });
    await expect(
      stat(path.join(tmpRoot, "agents", "Shared Library", "release-triage", "AGENT.md"))
    ).resolves.toMatchObject({ isFile: expect.any(Function) });
  });

  it("does not copy separately detected agent folders into a root skill import", async () => {
    const fetchStub = vi.fn(async () =>
      createFetchResponse({
        "skillful-library-main/SKILL.md": strToU8("# Root Skill\n"),
        "skillful-library-main/README.md": strToU8("# Shared docs\n"),
        "skillful-library-main/agents/release-triage/AGENT.md": strToU8("# Release Triage\n"),
      })
    );

    await importLibraryCollectionFromGitHub(
      tmpRoot,
      {
        name: "Mixed Root",
        repo: "Mastermindzh/skillful-library",
      },
      fetchStub as typeof fetch
    );

    await expect(
      stat(path.join(tmpRoot, "skills", "Mixed Root", "skillful-library", "SKILL.md"))
    ).resolves.toMatchObject({ isFile: expect.any(Function) });
    await expect(
      stat(path.join(tmpRoot, "skills", "Mixed Root", "skillful-library", "README.md"))
    ).resolves.toMatchObject({ isFile: expect.any(Function) });
    await expect(
      stat(
        path.join(
          tmpRoot,
          "skills",
          "Mixed Root",
          "skillful-library",
          "agents",
          "release-triage",
          "AGENT.md"
        )
      )
    ).rejects.toThrow();
    await expect(
      stat(path.join(tmpRoot, "agents", "Mixed Root", "release-triage", "AGENT.md"))
    ).resolves.toMatchObject({ isFile: expect.any(Function) });
  });

  it("uses paths relative to a selected skills folder", async () => {
    const fetchStub = vi.fn(async () =>
      createFetchResponse({
        "skillful-library-main/skills/debug-checklist/SKILL.md": strToU8("# Debug Checklist\n"),
        "skillful-library-main/skills/review-pr/SKILL.md": strToU8("# Review PR\n"),
        "skillful-library-main/agents/release-triage/AGENT.md": strToU8("# Release Triage\n"),
      })
    );

    await importLibraryCollectionFromGitHub(
      tmpRoot,
      {
        name: "Only Skills",
        repo: "Mastermindzh/skillful-library",
        path: "skills",
      },
      fetchStub as typeof fetch
    );

    await expect(
      stat(path.join(tmpRoot, "skills", "Only Skills", "debug-checklist", "SKILL.md"))
    ).resolves.toMatchObject({ isFile: expect.any(Function) });
    await expect(
      stat(path.join(tmpRoot, "skills", "Only Skills", "review-pr", "SKILL.md"))
    ).resolves.toMatchObject({ isFile: expect.any(Function) });
    await expect(stat(path.join(tmpRoot, "skills", "Only Skills", "skills"))).rejects.toThrow();
    await expect(
      stat(path.join(tmpRoot, "agents", "Only Skills", "release-triage"))
    ).rejects.toThrow();
  });

  it("preserves nested relative paths instead of flattening duplicate leaf folder names", async () => {
    const fetchStub = vi.fn(async () =>
      createFetchResponse({
        "skillful-library-main/reviews/backend/review-pr/SKILL.md": strToU8("# Backend Review\n"),
        "skillful-library-main/reviews/frontend/review-pr/SKILL.md": strToU8("# Frontend Review\n"),
      })
    );

    await importLibraryCollectionFromGitHub(
      tmpRoot,
      {
        name: "Nested Reviews",
        repo: "Mastermindzh/skillful-library",
      },
      fetchStub as typeof fetch
    );

    await expect(
      stat(
        path.join(
          tmpRoot,
          "skills",
          "Nested Reviews",
          "reviews",
          "backend",
          "review-pr",
          "SKILL.md"
        )
      )
    ).resolves.toMatchObject({ isFile: expect.any(Function) });
    await expect(
      stat(
        path.join(
          tmpRoot,
          "skills",
          "Nested Reviews",
          "reviews",
          "frontend",
          "review-pr",
          "SKILL.md"
        )
      )
    ).resolves.toMatchObject({ isFile: expect.any(Function) });
  });

  it("treats nested entry files inside a detected skill as supporting files", async () => {
    const fetchStub = vi.fn(async () =>
      createFetchResponse({
        "skillful-library-main/skills/review-pr/SKILL.md": strToU8("# Review PR\n"),
        "skillful-library-main/skills/review-pr/examples/SKILL.md":
          strToU8("# Supporting Example\n"),
      })
    );

    await importLibraryCollectionFromGitHub(
      tmpRoot,
      {
        name: "Nested Support",
        repo: "Mastermindzh/skillful-library",
      },
      fetchStub as typeof fetch
    );

    await expect(
      stat(path.join(tmpRoot, "skills", "Nested Support", "review-pr", "SKILL.md"))
    ).resolves.toMatchObject({ isFile: expect.any(Function) });
    await expect(
      stat(path.join(tmpRoot, "skills", "Nested Support", "review-pr", "examples", "SKILL.md"))
    ).resolves.toMatchObject({ isFile: expect.any(Function) });
  });

  it("imports a nested item when the selected path points directly at it", async () => {
    const fetchStub = vi.fn(async () =>
      createFetchResponse({
        "skillful-library-main/skills/review-pr/SKILL.md": strToU8("# Review PR\n"),
        "skillful-library-main/skills/review-pr/examples/SKILL.md":
          strToU8("# Supporting Example\n"),
      })
    );

    await importLibraryCollectionFromGitHub(
      tmpRoot,
      {
        name: "Selected Nested",
        repo: "Mastermindzh/skillful-library",
        path: "skills/review-pr/examples",
      },
      fetchStub as typeof fetch
    );

    await expect(
      stat(path.join(tmpRoot, "skills", "Selected Nested", "examples", "SKILL.md"))
    ).resolves.toMatchObject({ isFile: expect.any(Function) });
    await expect(
      stat(path.join(tmpRoot, "skills", "Selected Nested", "review-pr", "SKILL.md"))
    ).rejects.toThrow();
  });

  it("rejects source archives that map multiple skill roots to the same destination", async () => {
    const fetchStub = vi.fn(async () =>
      createFetchResponse({
        "skillful-library-main/review-pr/SKILL.md": strToU8("# Root Review PR\n"),
        "skillful-library-main/skills/review-pr/SKILL.md": strToU8("# Skill Review PR\n"),
      })
    );

    await expectAppError(
      importLibraryCollectionFromGitHub(
        tmpRoot,
        {
          name: "Duplicate Reviews",
          repo: "Mastermindzh/skillful-library",
        },
        fetchStub as typeof fetch
      ),
      "invalid-name"
    );
    await expect(stat(path.join(tmpRoot, "skills", "Duplicate Reviews"))).rejects.toThrow();
  });

  it("rejects archives that do not contain any detected skills or agents", async () => {
    const fetchStub = vi.fn(async () =>
      createFetchResponse({
        "skillful-library-main/README.md": strToU8("# nothing useful here\n"),
      })
    );

    await expectAppError(
      importLibraryCollectionFromGitHub(
        tmpRoot,
        {
          name: "Broken Import",
          repo: "Mastermindzh/skillful-library",
        },
        fetchStub as typeof fetch
      ),
      "invalid-path"
    );
  });
});
