import { afterEach, describe, expect, it, vi } from "vitest";
import type { GitLibraryConfig, GitLibrarySyncResult } from "../../shared/types";
import { GitLibrarySyncScheduler } from "./librarySyncScheduler";

function library(overrides: Partial<GitLibraryConfig> = {}): GitLibraryConfig {
  return {
    id: "library-1",
    name: "Team skills",
    remoteUrl: "git@example.com:me/skills.git",
    branch: "main",
    path: "",
    syncMode: "pull",
    autoSync: true,
    syncIntervalMinutes: 10,
    readOnly: false,
    ...overrides,
  };
}

function result(overrides: Partial<GitLibrarySyncResult> = {}): GitLibrarySyncResult {
  return {
    libraryId: "library-1",
    state: "up-to-date",
    path: "/tmp/library-1",
    remoteUrl: "git@example.com:me/skills.git",
    branch: "main",
    cloned: false,
    pulled: false,
    pushed: false,
    localChanges: [],
    ...overrides,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("GitLibrarySyncScheduler", () => {
  it("syncs each library on its own interval", async () => {
    vi.useFakeTimers();
    const runSync = vi.fn(async (libraryId: string) => result({ libraryId }));
    const scheduler = new GitLibrarySyncScheduler(runSync, vi.fn());

    scheduler.configure([
      library({ id: "fast", syncIntervalMinutes: 5 }),
      library({ id: "slow", syncIntervalMinutes: 30 }),
    ]);

    await vi.advanceTimersByTimeAsync(5 * 60_000);
    expect(runSync.mock.calls.map(([id]) => id)).toEqual(["fast"]);

    await vi.advanceTimersByTimeAsync(25 * 60_000);
    expect(runSync.mock.calls.filter(([id]) => id === "slow")).toHaveLength(1);

    scheduler.dispose();
  });

  it("does not schedule libraries with auto sync disabled", async () => {
    vi.useFakeTimers();
    const runSync = vi.fn(async (libraryId: string) => result({ libraryId }));
    const scheduler = new GitLibrarySyncScheduler(runSync, vi.fn());

    scheduler.configure([library({ autoSync: false })]);

    await vi.advanceTimersByTimeAsync(60 * 60_000);
    expect(runSync).not.toHaveBeenCalled();

    scheduler.dispose();
  });

  it("stops timers for libraries that were removed", async () => {
    vi.useFakeTimers();
    const runSync = vi.fn(async (libraryId: string) => result({ libraryId }));
    const scheduler = new GitLibrarySyncScheduler(runSync, vi.fn());

    scheduler.configure([library({ id: "gone", syncIntervalMinutes: 5 })]);
    scheduler.configure([]);

    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(runSync).not.toHaveBeenCalled();

    scheduler.dispose();
  });

  it("notifies only for states the user needs to act on", async () => {
    const notify = vi.fn();
    const scheduler = new GitLibrarySyncScheduler(
      async (libraryId) => result({ libraryId, state: "up-to-date" }),
      notify
    );
    scheduler.configure([library()]);

    await scheduler.runNow("library-1");
    expect(notify).not.toHaveBeenCalled();

    const failing = new GitLibrarySyncScheduler(
      async (libraryId) => result({ libraryId, state: "auth-failed" }),
      notify
    );
    failing.configure([library()]);

    await failing.runNow("library-1");
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ state: "auth-failed" }));

    scheduler.dispose();
    failing.dispose();
  });

  it("never runs a second sync for a library while one is in flight", async () => {
    let release: (() => void) | undefined;
    const runSync = vi.fn(
      (libraryId: string) =>
        new Promise<GitLibrarySyncResult>((resolve) => {
          release = () => resolve(result({ libraryId }));
        })
    );
    const scheduler = new GitLibrarySyncScheduler(runSync, vi.fn());
    scheduler.configure([library()]);

    const first = scheduler.runNow("library-1");
    await scheduler.runNow("library-1");
    expect(runSync).toHaveBeenCalledTimes(1);

    release?.();
    await first;
    scheduler.dispose();
  });

  it("reports a thrown sync as an error result", async () => {
    const notify = vi.fn();
    const scheduler = new GitLibrarySyncScheduler(async () => {
      throw new Error("git exploded");
    }, notify);
    scheduler.configure([library()]);

    await scheduler.runNow("library-1");

    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({ state: "error", message: "git exploded" })
    );
    scheduler.dispose();
  });
});
