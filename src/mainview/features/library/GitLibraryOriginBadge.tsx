import { Text, Tooltip } from "@mantine/core";
import { GitBranch, Lock } from "lucide-react";
import { formatGitRemoteLabel } from "../../../shared/gitRemote";
import type { GitLibraryConfig } from "../../../shared/types";
import { useAppTranslation } from "../../i18n/i18n";

type GitLibraryOriginBadgeProps = {
  library: GitLibraryConfig;
  syncedAt?: string;
};

function formatSyncedAt(syncedAt: string | undefined, locale: string) {
  if (!syncedAt) return null;
  const parsed = new Date(syncedAt);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });
}

/** Marks a library item as coming from a synced git clone rather than the local library. */
export function GitLibraryOriginBadge({ library, syncedAt }: GitLibraryOriginBadgeProps) {
  const { t, i18n } = useAppTranslation();
  const syncedLabel = formatSyncedAt(syncedAt, i18n.language);

  return (
    <Tooltip
      withArrow
      openDelay={300}
      multiline
      label={
        <Text size="xs" component="div">
          <Text size="xs" fw={600} component="div">
            {library.name}
          </Text>
          <Text size="xs" component="div" ff="monospace">
            {formatGitRemoteLabel(library.remoteUrl, library.branch)}
          </Text>
          <Text size="xs" component="div">
            {syncedLabel
              ? t("library.gitOrigin.lastSynced", { time: syncedLabel })
              : t("library.gitOrigin.neverSynced")}
          </Text>
          {library.readOnly ? (
            <Text size="xs" component="div">
              {t("library.gitOrigin.readOnly")}
            </Text>
          ) : null}
        </Text>
      }
    >
      <span
        className="library-git-origin"
        role="img"
        aria-label={t("library.gitOrigin.ariaLabel", { name: library.name })}
      >
        <GitBranch size={12} />
        {library.readOnly ? <Lock size={10} /> : null}
      </span>
    </Tooltip>
  );
}
