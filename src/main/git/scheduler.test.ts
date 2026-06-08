import { afterEach, describe, expect, it, vi } from "vitest";
import type { GitBackupConfig, GitBackupResult } from "../../shared/types";
import { GitBackupScheduler } from "./scheduler";

function config(overrides: Partial<GitBackupConfig> = {}): GitBackupConfig {
  return {
    enabled: true,
    remoteUrl: "git@example.com:me/skillful.git",
    branch: "main",
    includeSettings: true,
    includeDefaultLibrary: true,
    autoBackup: true,
    autoBackupIntervalMinutes: 10,
    ...overrides,
  };
}

function result(overrides: Partial<GitBackupResult> = {}): GitBackupResult {
  return {
    state: "ready",
    remoteUrl: "git@example.com:me/skillful.git",
    branch: "main",
    changed: true,
    pushed: true,
    message: "Backup pushed.",
    ...overrides,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("GitBackupScheduler", () => {
  it("runs backups on the configured minute interval", async () => {
    vi.useFakeTimers();
    const runBackup = vi.fn().mockResolvedValue(result());
    const notify = vi.fn();
    const scheduler = new GitBackupScheduler(runBackup, notify);

    scheduler.configure(config({ autoBackupIntervalMinutes: 5 }));

    await vi.advanceTimersByTimeAsync(4 * 60_000);
    expect(runBackup).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(60_000);
    expect(runBackup).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ changed: true, pushed: true }));

    scheduler.dispose();
  });

  it("does not notify when the backup is already up to date", async () => {
    const runBackup = vi.fn().mockResolvedValue(
      result({
        state: "up-to-date",
        changed: false,
        pushed: false,
        message: "Backup is already up to date.",
      })
    );
    const notify = vi.fn();
    const scheduler = new GitBackupScheduler(runBackup, notify);

    scheduler.configure(config());
    await scheduler.runNow();

    expect(runBackup).toHaveBeenCalledTimes(1);
    expect(notify).not.toHaveBeenCalled();

    scheduler.dispose();
  });

  it("reports failed scheduled backups", async () => {
    const runBackup = vi.fn().mockResolvedValue(
      result({
        state: "auth-failed",
        changed: false,
        pushed: false,
        message: "Permission denied.",
      })
    );
    const notify = vi.fn();
    const scheduler = new GitBackupScheduler(runBackup, notify);

    scheduler.configure(config());
    await scheduler.runNow();

    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ state: "auth-failed" }));

    scheduler.dispose();
  });
});
