import type { GitBackupConfig } from "../../../shared/types";
import type { TranslationKey } from "../../i18n/messages";
import { cleanPath, isAbsolutePath } from "./paths";

export type GitBackupIssue = {
  repositoryPath?: TranslationKey;
  remoteUrl?: TranslationKey;
  branch?: TranslationKey;
  autoBackupIntervalMinutes?: TranslationKey;
};

export type GitBackupValidation = {
  config: GitBackupConfig;
  issue: GitBackupIssue;
  hasErrors: boolean;
};

export function defaultGitBackupConfig(): GitBackupConfig {
  return {
    enabled: false,
    repositoryPath: "",
    remoteUrl: "",
    branch: "main",
    includeSettings: true,
    includeDefaultLibrary: true,
    autoBackup: false,
    autoBackupIntervalMinutes: 10,
  };
}

export function validateGitBackupConfig(config: GitBackupConfig): GitBackupValidation {
  const autoBackupIntervalMinutes = Number(config.autoBackupIntervalMinutes);
  const nextConfig: GitBackupConfig = {
    ...config,
    repositoryPath: cleanPath(config.repositoryPath),
    remoteUrl: config.remoteUrl.trim(),
    branch: config.branch.trim(),
    autoBackupIntervalMinutes: Number.isFinite(autoBackupIntervalMinutes)
      ? Math.trunc(autoBackupIntervalMinutes)
      : 0,
  };
  const issue: GitBackupIssue = {};

  if (nextConfig.enabled) {
    if (!nextConfig.repositoryPath) {
      issue.repositoryPath = "settings.backup.error.repositoryRequired";
    } else if (!isAbsolutePath(nextConfig.repositoryPath)) {
      issue.repositoryPath = "settings.error.absolutePath";
    }

    if (!nextConfig.remoteUrl) {
      issue.remoteUrl = "settings.backup.error.remoteRequired";
    }

    if (!nextConfig.branch) {
      issue.branch = "settings.backup.error.branchRequired";
    } else if (/\s/.test(nextConfig.branch)) {
      issue.branch = "settings.backup.error.branchWhitespace";
    }

    if (
      nextConfig.autoBackup &&
      (!Number.isInteger(nextConfig.autoBackupIntervalMinutes) ||
        nextConfig.autoBackupIntervalMinutes < 1)
    ) {
      issue.autoBackupIntervalMinutes = "settings.backup.error.autoBackupInterval";
    }
  }

  return {
    config: nextConfig,
    issue,
    hasErrors: Boolean(
      issue.repositoryPath || issue.remoteUrl || issue.branch || issue.autoBackupIntervalMinutes
    ),
  };
}

export function sameGitBackupConfig(left: GitBackupConfig, right: GitBackupConfig) {
  return (
    left.enabled === right.enabled &&
    left.repositoryPath === right.repositoryPath &&
    left.remoteUrl === right.remoteUrl &&
    left.branch === right.branch &&
    left.includeSettings === right.includeSettings &&
    left.includeDefaultLibrary === right.includeDefaultLibrary &&
    left.autoBackup === right.autoBackup &&
    left.autoBackupIntervalMinutes === right.autoBackupIntervalMinutes
  );
}
