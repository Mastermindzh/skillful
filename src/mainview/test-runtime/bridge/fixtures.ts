import type {
  AppSettings,
  LibraryItemCollectionSummary,
  LibraryItemDocument,
} from "../../../shared/types";
import type {
  AppUpdateLocalInfo,
  AppUpdateRemoteInfo,
  AppUpdateState,
} from "../../../shared/updates";
import { clone, compareLabels, defaultEntryContent, normalizeEditableFile } from "./helpers";
import type { MockFixture, MockState } from "./types";

export const fixtureConfig: MockFixture = window.__SKILLFUL_E2E_FIXTURE__ ?? defaultFixture();

export function normalizeCollections(
  collections: LibraryItemCollectionSummary[],
  documents: LibraryItemDocument[]
) {
  const known = new Map(collections.map((collection) => [collection.id, collection]));
  for (const document of documents) {
    if (!known.has(document.item.collectionId)) {
      known.set(document.item.collectionId, {
        id: document.item.collectionId,
        title: document.item.collectionId,
      });
    }
  }
  return [...known.values()].sort((a, b) => compareLabels(a.title, b.title));
}

export function normalizeSettings(settings?: Partial<AppSettings>): AppSettings {
  return {
    scanRoots: settings?.scanRoots ?? [],
    defaultScanRoot: settings?.defaultScanRoot ?? "/mock/skillful",
    effectiveScanRoots: settings?.effectiveScanRoots ?? [
      settings?.defaultScanRoot ?? "/mock/skillful",
    ],
    homeDirectory: settings?.homeDirectory ?? "/mock/home",
    platform: settings?.platform ?? "linux",
    tools: settings?.tools ?? [],
    toolMappings: settings?.toolMappings ?? [],
    suppressSuccessNotifications: settings?.suppressSuccessNotifications ?? false,
    language: settings?.language ?? "system",
    defaultEditorMode: settings?.defaultEditorMode ?? "preview",
    onboardingTourCompleted: settings?.onboardingTourCompleted ?? true,
  };
}

export function normalizeDocuments(documents?: LibraryItemDocument[]) {
  return (documents ?? []).map((document) => ({
    item: clone(document.item),
    files: document.files.map((file) => normalizeEditableFile(document.item.rootPath, file)),
    additionalFiles: document.additionalFiles.map((file) => ({
      ...file,
      absolutePath: file.absolutePath || `${document.item.rootPath}/${file.relativePath}`,
    })),
  }));
}

export function defaultFixture(): MockFixture {
  const collectionId = "test-collection";
  const skillRoot = `/mock/skillful/${collectionId}/review-pr`;
  const agentRoot = `/mock/skillful/${collectionId}/release-triage-agent`;

  const skillDocument: LibraryItemDocument = {
    item: {
      id: "skill-review-pr",
      kind: "skill",
      collectionId,
      title: "Review PR",
      description: "Review a pull request with a bug-risk-first mindset.",
      rootPath: skillRoot,
      entryPath: `${skillRoot}/SKILL.md`,
      supportingFiles: ["notes.md"],
    },
    files: [
      {
        relativePath: "SKILL.md",
        absolutePath: `${skillRoot}/SKILL.md`,
        content: defaultEntryContent({
          kind: "skill",
          title: "Review PR",
          description: "Review a pull request with a bug-risk-first mindset.",
        }),
        isEntry: true,
      },
      {
        relativePath: "notes.md",
        absolutePath: `${skillRoot}/notes.md`,
        content: "# Review Notes\n\n- Repro steps\n- Suspected regression\n",
        isEntry: false,
      },
    ],
    additionalFiles: [
      {
        relativePath: "fixtures/request.json",
        absolutePath: `${skillRoot}/fixtures/request.json`,
      },
    ],
  };

  const agentDocument: LibraryItemDocument = {
    item: {
      id: "agent-release-triage",
      kind: "agent",
      collectionId,
      title: "Release Triage Agent",
      description: "Organizes release notes, packaging checks, and launch blockers.",
      rootPath: agentRoot,
      entryPath: `${agentRoot}/AGENT.md`,
      supportingFiles: [],
    },
    files: [
      {
        relativePath: "AGENT.md",
        absolutePath: `${agentRoot}/AGENT.md`,
        content: defaultEntryContent({
          kind: "agent",
          title: "Release Triage Agent",
          description: "Organizes release notes, packaging checks, and launch blockers.",
        }),
        isEntry: true,
      },
    ],
    additionalFiles: [],
  };

  return {
    collections: [{ id: collectionId, title: "Test Collection" }],
    documents: [skillDocument, agentDocument],
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
      onboardingTourCompleted: true,
    },
    updateState: {
      localInfo: {
        version: "0.0.2",
        hash: "currenthash",
        baseUrl: "https://example.invalid/releases/latest/download",
        channel: "stable",
        name: "skillful",
        identifier: "tech.mastermindzh.skillful",
      },
      updateInfo: {
        version: "0.0.3",
        hash: "nexthash",
        updateAvailable: true,
        updateReady: false,
        error: "",
      },
      latestStatus: {
        status: "update-available",
        message: "Update available",
        timestamp: Date.now(),
      },
      statusHistory: [],
    },
  };
}

export function normalizeUpdateState(updateState?: Partial<AppUpdateState>): AppUpdateState {
  const fallbackLocalInfo: AppUpdateLocalInfo = {
    version: "0.0.1",
    hash: "mockhash",
    baseUrl: "https://example.invalid/releases/latest/download",
    channel: "stable",
    name: "skillful",
    identifier: "tech.mastermindzh.skillful",
  };
  const fallbackUpdateInfo: AppUpdateRemoteInfo = {
    version: "0.0.1",
    hash: "mockhash",
    updateAvailable: false,
    updateReady: false,
    error: "",
  };
  const fallback = defaultFixture().updateState;
  return {
    localInfo: {
      ...(fallback?.localInfo ?? fallbackLocalInfo),
      ...(updateState?.localInfo ?? {}),
    },
    updateInfo: updateState?.updateInfo
      ? {
          ...(fallback?.updateInfo ?? fallbackUpdateInfo),
          ...updateState.updateInfo,
        }
      : (fallback?.updateInfo ?? fallbackUpdateInfo),
    latestStatus: updateState?.latestStatus ?? fallback?.latestStatus ?? null,
    statusHistory: updateState?.statusHistory ?? fallback?.statusHistory ?? [],
  };
}

export function createInitialState(): MockState {
  const fixture = fixtureConfig;
  const documents = normalizeDocuments(fixture.documents);
  return {
    settings: normalizeSettings(fixture.settings),
    collections: normalizeCollections(fixture.collections ?? [], documents),
    documents,
    updateState: normalizeUpdateState(fixture.updateState),
  };
}
