import { onAppMessage } from "@mainview-bridge";
import { useEffect } from "react";
import type { GitLibraryConfig } from "../../../shared/types";
import { useAppTranslation } from "../../i18n/i18n";
import { notify } from "./notify";

/** Toasts for work the main process finishes in the background: auto backups and git syncs. */
export function useAppNotifications(gitLibraries: GitLibraryConfig[] | undefined) {
  const { t } = useAppTranslation();

  useEffect(() => {
    return onAppMessage("autoGitBackupCompleted", (result) => {
      if (result.changed && result.pushed) {
        notify.info(t("settings.backup.notification.synced.message", { branch: result.branch }), {
          title: t("settings.backup.notification.synced.title"),
        });
        return;
      }
      notify.error(result.message || t("settings.backup.error.run"), {
        title: t("settings.backup.notification.failed.title"),
      });
    });
  }, [t]);

  useEffect(() => {
    return onAppMessage("gitLibrarySynced", (result) => {
      const name =
        gitLibraries?.find((entry) => entry.id === result.libraryId)?.name || result.remoteUrl;
      if (result.cloned) {
        notify.info(t("settings.gitLibrary.notification.cloned.message", { name }), {
          title: t("settings.gitLibrary.notification.synced.title"),
        });
        return;
      }
      if (result.state === "updated") {
        notify.info(t("settings.gitLibrary.notification.synced.message", { name }), {
          title: t("settings.gitLibrary.notification.synced.title"),
        });
        return;
      }
      notify.error(result.message || t("settings.gitLibrary.state.error"), {
        title: t("settings.gitLibrary.notification.failed.title"),
      });
    });
  }, [gitLibraries, t]);
}
