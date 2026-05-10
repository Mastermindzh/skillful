import type { MockFixture } from "../../src/mainview/test-runtime/bridge";

const appVersion = process.env.SKILLFUL_APP_VERSION ?? "0.0.0";
const importedArchivePath = "/mock/archives/design-system-library.skillful.zip";
const emptyArchivePath = "/mock/archives/empty-archive.skillful.zip";
const githubImportKey = JSON.stringify({
  repo: "Mastermindzh/skillful-library",
  ref: "main",
  path: "skills/debug-checklist",
});

export const baseFixture: MockFixture = {
  collections: [{ id: "test-collection", title: "Test Collection" }],
  documents: [
    {
      item: {
        id: "skill-review-pr",
        kind: "skill",
        collectionId: "test-collection",
        title: "Review PR",
        description: "Review a pull request with a bug-risk-first mindset.",
        rootPath: "/mock/skillful/test-collection/review-pr",
        entryPath: "/mock/skillful/test-collection/review-pr/SKILL.md",
        supportingFiles: ["notes.md"],
      },
      files: [
        {
          relativePath: "SKILL.md",
          absolutePath: "/mock/skillful/test-collection/review-pr/SKILL.md",
          content: "# Review PR\n\nStart from the failing path.\n",
          isEntry: true,
        },
        {
          relativePath: "notes.md",
          absolutePath: "/mock/skillful/test-collection/review-pr/notes.md",
          content: "# Notes\n\n- risk area\n",
          isEntry: false,
        },
      ],
      additionalFiles: [
        {
          relativePath: "fixtures/request.json",
          absolutePath: "/mock/skillful/test-collection/review-pr/fixtures/request.json",
        },
      ],
    },
    {
      item: {
        id: "agent-release-triage",
        kind: "agent",
        collectionId: "test-collection",
        title: "Release Triage Agent",
        description: "Organizes release notes, packaging checks, and launch blockers.",
        rootPath: "/mock/skillful/test-collection/release-triage-agent",
        entryPath: "/mock/skillful/test-collection/release-triage-agent/AGENT.md",
        supportingFiles: [],
      },
      files: [
        {
          relativePath: "AGENT.md",
          absolutePath: "/mock/skillful/test-collection/release-triage-agent/AGENT.md",
          content: "# Release Triage Agent\n\nOrganize launch blockers.\n",
          isEntry: true,
        },
      ],
      additionalFiles: [],
    },
  ],
  settings: {
    defaultScanRoot: "/mock/skillful",
    effectiveScanRoots: ["/mock/skillful"],
    homeDirectory: "/mock/home",
    platform: "linux",
    scanRoots: [],
    tools: [
      {
        id: "codex",
        name: "Codex",
        installRoots: {
          skill: ["/mock/home/.codex/skills"],
          agent: [],
        },
      },
    ],
    toolMappings: [{ itemId: "skill-review-pr", toolIds: ["codex"] }],
  },
  updateState: {
    localInfo: {
      version: appVersion,
      hash: "currenthash",
      baseUrl: "https://example.invalid/releases/latest/download",
      channel: "stable",
      name: "skillful",
      identifier: "tech.mastermindzh.skillful",
    },
    updateInfo: {
      version: "9.9.9",
      hash: "nexthash",
      updateAvailable: true,
      updateReady: false,
      error: "",
    },
    latestStatus: {
      status: "update-available",
      message: "Update available",
      timestamp: 1,
    },
    statusHistory: [],
  },
};

export const importedCollectionArchiveFixture: MockFixture = {
  ...baseFixture,
  pickImportArchivePath: importedArchivePath,
  archiveImports: {
    [importedArchivePath]: {
      collection: { id: "design-system-library", title: "Design System Library" },
      documents: [
        {
          item: {
            id: "skill-archive-checklist",
            kind: "skill",
            collectionId: "design-system-library",
            title: "Archive Checklist",
            description: "Imported from an archive fixture.",
            rootPath: "/mock/skillful/design-system-library/archive-checklist",
            entryPath: "/mock/skillful/design-system-library/archive-checklist/SKILL.md",
            supportingFiles: ["notes.md"],
          },
          files: [
            {
              relativePath: "SKILL.md",
              absolutePath: "/mock/skillful/design-system-library/archive-checklist/SKILL.md",
              content: "# Archive Checklist\n\nImported from an archive fixture.\n",
              isEntry: true,
            },
            {
              relativePath: "notes.md",
              absolutePath: "/mock/skillful/design-system-library/archive-checklist/notes.md",
              content: "# Notes\n\n- archive import\n",
              isEntry: false,
            },
          ],
          additionalFiles: [],
        },
      ],
    },
  },
};

export const emptyCollectionArchiveFixture: MockFixture = {
  ...baseFixture,
  pickImportArchivePath: emptyArchivePath,
  archiveImports: {
    [emptyArchivePath]: {
      collection: { id: "empty-archive", title: "Empty Archive" },
      documents: [],
    },
  },
};

export const githubImportFixture: MockFixture = {
  ...baseFixture,
  githubImports: {
    [githubImportKey]: {
      collection: { id: "github-imports", title: "GitHub Imports" },
      documents: [
        {
          item: {
            id: "skill-debug-checklist",
            kind: "skill",
            collectionId: "github-imports",
            title: "Debug Checklist",
            description: "Imported from a public GitHub source archive.",
            rootPath: "/mock/skillful/github-imports/debug-checklist",
            entryPath: "/mock/skillful/github-imports/debug-checklist/SKILL.md",
            supportingFiles: ["notes.md"],
          },
          files: [
            {
              relativePath: "SKILL.md",
              absolutePath: "/mock/skillful/github-imports/debug-checklist/SKILL.md",
              content: "# Debug Checklist\n\nImported from GitHub.\n",
              isEntry: true,
            },
            {
              relativePath: "notes.md",
              absolutePath: "/mock/skillful/github-imports/debug-checklist/notes.md",
              content: "# Notes\n\n- reproduce\n",
              isEntry: false,
            },
          ],
          additionalFiles: [],
        },
      ],
    },
  },
};

export const pendingGitHubImportFixture: MockFixture = {
  ...githubImportFixture,
  pendingGitHubImport: {
    repo: "Mastermindzh/skillful-library",
    ref: "main",
    path: "skills/debug-checklist",
    name: "GitHub Imports",
  },
};

export const agentInstallRootsFixture: MockFixture = {
  ...baseFixture,
  settings: {
    ...baseFixture.settings,
    tools: [
      {
        id: "claude-code",
        name: "Claude Code",
        installRoots: {
          skill: ["/mock/home/.claude/skills"],
          agent: ["/mock/home/.claude/agents"],
        },
      },
      ...(baseFixture.settings?.tools ?? []),
    ],
    toolMappings: [{ itemId: "agent-release-triage", toolIds: ["claude-code"] }],
  },
};

export const missingToolParentFixture: MockFixture = {
  ...baseFixture,
  missingToolParentPath: "/mock/missing-tool",
  settings: {
    ...baseFixture.settings,
    tools: [
      {
        id: "missing-parent-tool",
        name: "Missing Parent Tool",
        installRoots: {
          skill: ["/mock/missing-tool/skills"],
          agent: [],
        },
      },
    ],
    toolMappings: [],
  },
};

export const launchLayoutFixture: MockFixture = {
  ...baseFixture,
  documents: [
    {
      item: {
        id: "skill-launch-layout",
        kind: "skill",
        collectionId: "test-collection",
        title: "Extremely long launch layout skill name that should leave room for the kind badge",
        description:
          "A long description used to make sure the list row still has enough room for the badge on launch.",
        rootPath: "/mock/skillful/test-collection/launch-layout-skill",
        entryPath: "/mock/skillful/test-collection/launch-layout-skill/SKILL.md",
        supportingFiles: [],
      },
      files: [
        {
          relativePath: "SKILL.md",
          absolutePath: "/mock/skillful/test-collection/launch-layout-skill/SKILL.md",
          content:
            "# Extremely long launch layout skill name that should leave room for the kind badge\n\nA long description used to make sure the list row still has enough room for the badge on launch.\n",
          isEntry: true,
        },
      ],
      additionalFiles: [],
    },
  ],
};
