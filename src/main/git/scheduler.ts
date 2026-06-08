import type { GitBackupConfig, GitBackupResult, GitBackupState } from "../../shared/types";

const MINUTE_MS = 60_000;
const NOTIFY_FAILURE_STATES = new Set<GitBackupState>([
  "missing-git",
  "auth-failed",
  "remote-unreachable",
  "dirty",
  "error",
]);

type Timer = ReturnType<typeof setInterval>;

function backupEnabled(config: GitBackupConfig) {
  return config.enabled && config.autoBackup && config.autoBackupIntervalMinutes >= 1;
}

function intervalMs(config: GitBackupConfig) {
  return Math.trunc(config.autoBackupIntervalMinutes) * MINUTE_MS;
}

function errorResult(config: GitBackupConfig, error: unknown): GitBackupResult {
  return {
    state: "error",
    remoteUrl: config.remoteUrl,
    branch: config.branch,
    changed: false,
    pushed: false,
    message: error instanceof Error ? error.message : String(error),
  };
}

function shouldNotify(result: GitBackupResult) {
  return (result.changed && result.pushed) || NOTIFY_FAILURE_STATES.has(result.state);
}

export class GitBackupScheduler {
  private timer: Timer | null = null;
  private config: GitBackupConfig | null = null;
  private running = false;

  constructor(
    private readonly runBackup: () => Promise<GitBackupResult>,
    private readonly notify: (result: GitBackupResult) => void
  ) {}

  configure(config: GitBackupConfig) {
    this.stop();
    this.config = { ...config };
    if (!backupEnabled(this.config)) return;

    this.timer = setInterval(() => {
      void this.runNow();
    }, intervalMs(this.config));
  }

  stop() {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  dispose() {
    this.stop();
  }

  async runNow() {
    if (this.running || !this.config || !backupEnabled(this.config)) return;
    this.running = true;

    try {
      const result = await this.runBackup();
      if (shouldNotify(result)) this.notify(result);
    } catch (error) {
      this.notify(errorResult(this.config, error));
    } finally {
      this.running = false;
    }
  }
}
