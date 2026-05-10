import type { UpdateStatusEntry } from "../../../../shared/updates";
import { emitUpdateStatus } from "../events";
import { clone, state } from "../state";
import type { RequestClient } from "../types";

function pushStatus(entry: UpdateStatusEntry) {
  state.updateState.latestStatus = clone(entry);
  state.updateState.statusHistory = [...state.updateState.statusHistory, clone(entry)];
  emitUpdateStatus(entry);
}

export const updateRequests = {
  async getUpdateState() {
    return clone(state.updateState);
  },
  async checkForUpdates() {
    pushStatus({
      status: state.updateState.updateInfo?.updateAvailable ? "update-available" : "no-update",
      message: state.updateState.updateInfo?.updateAvailable
        ? "Update available"
        : "Already on latest version",
      timestamp: Date.now(),
    });
    return clone(state.updateState);
  },
  async downloadUpdate() {
    state.updateState.updateInfo = {
      ...(state.updateState.updateInfo ?? {
        version: state.updateState.localInfo?.version ?? "",
        hash: state.updateState.localInfo?.hash ?? "",
        updateAvailable: false,
        updateReady: false,
        error: "",
      }),
      updateReady: true,
    };
    pushStatus({
      status: "download-complete",
      message: "Update downloaded",
      timestamp: Date.now(),
    });
    return clone(state.updateState);
  },
  async applyUpdate() {
    state.updateState.updateInfo = state.updateState.updateInfo
      ? {
          ...state.updateState.updateInfo,
          updateAvailable: false,
          updateReady: false,
        }
      : null;
    pushStatus({
      status: "complete",
      message: "Update complete",
      timestamp: Date.now(),
    });
    return undefined;
  },
} satisfies Pick<
  RequestClient,
  "getUpdateState" | "checkForUpdates" | "downloadUpdate" | "applyUpdate"
>;
