import type {
  GitLibraryConfig,
  GitLibrarySyncResult,
  GitLibrarySyncState,
} from "../../shared/types";

const MINUTE_MS = 60_000;
const NOTIFY_STATES = new Set<GitLibrarySyncState>([
  "updated",
  "diverged",
  "missing-git",
  "auth-failed",
  "host-key-unverified",
  "remote-unreachable",
  "error",
]);

type Timer = ReturnType<typeof setInterval>;

function autoSyncEnabled(library: GitLibraryConfig) {
  return library.autoSync && library.syncIntervalMinutes >= 0 && Boolean(library.remoteUrl.trim());
}

function errorResult(library: GitLibraryConfig, error: unknown): GitLibrarySyncResult {
  return {
    libraryId: library.id,
    state: "error",
    path: "",
    remoteUrl: library.remoteUrl,
    branch: library.branch,
    cloned: false,
    pulled: false,
    pushed: false,
    localChanges: [],
    message: error instanceof Error ? error.message : String(error),
  };
}

/**
 * Runs each git library on its own interval. Libraries are keyed by id, so reconfiguring only
 * restarts timers whose schedule actually changed and a slow sync can never overlap itself.
 */
export class GitLibrarySyncScheduler {
  private timers = new Map<string, Timer>();
  private libraries = new Map<string, GitLibraryConfig>();
  private running = new Set<string>();

  constructor(
    private readonly runSync: (libraryId: string) => Promise<GitLibrarySyncResult>,
    private readonly notify: (result: GitLibrarySyncResult) => void
  ) {}

  configure(gitLibraries: GitLibraryConfig[]) {
    const nextIds = new Set(gitLibraries.map((library) => library.id));
    for (const id of [...this.timers.keys()]) {
      if (!nextIds.has(id)) this.stopLibrary(id);
    }

    for (const library of gitLibraries) {
      const previous = this.libraries.get(library.id);
      this.libraries.set(library.id, { ...library });

      if (!autoSyncEnabled(library)) {
        this.stopTimer(library.id);
        continue;
      }

      const unchanged =
        previous &&
        this.timers.has(library.id) &&
        previous.autoSync === library.autoSync &&
        previous.syncIntervalMinutes === library.syncIntervalMinutes;
      if (unchanged) continue;

      this.stopTimer(library.id);
      this.timers.set(
        library.id,
        setInterval(() => {
          void this.runNow(library.id);
        }, Math.trunc(library.syncIntervalMinutes) * MINUTE_MS)
      );
    }
  }

  private stopTimer(libraryId: string) {
    const timer = this.timers.get(libraryId);
    if (!timer) return;
    clearInterval(timer);
    this.timers.delete(libraryId);
  }

  private stopLibrary(libraryId: string) {
    this.stopTimer(libraryId);
    this.libraries.delete(libraryId);
  }

  dispose() {
    for (const id of [...this.timers.keys()]) this.stopTimer(id);
    this.libraries.clear();
  }

  async runNow(libraryId: string) {
    const library = this.libraries.get(libraryId);
    if (!library || this.running.has(libraryId)) return;
    this.running.add(libraryId);

    try {
      const result = await this.runSync(libraryId);
      if (NOTIFY_STATES.has(result.state)) this.notify(result);
    } catch (error) {
      this.notify(errorResult(library, error));
    } finally {
      this.running.delete(libraryId);
    }
  }
}
