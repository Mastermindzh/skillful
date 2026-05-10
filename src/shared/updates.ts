export type UpdateStatusType =
  | "idle"
  | "checking"
  | "check-complete"
  | "no-update"
  | "update-available"
  | "downloading"
  | "download-starting"
  | "checking-local-tar"
  | "local-tar-found"
  | "local-tar-missing"
  | "fetching-patch"
  | "patch-found"
  | "patch-not-found"
  | "downloading-patch"
  | "applying-patch"
  | "patch-applied"
  | "patch-failed"
  | "extracting-version"
  | "patch-chain-complete"
  | "downloading-full-bundle"
  | "download-progress"
  | "decompressing"
  | "download-complete"
  | "applying"
  | "extracting"
  | "replacing-app"
  | "launching-new-version"
  | "complete"
  | "error";

export interface UpdateStatusDetails {
  fromHash?: string;
  toHash?: string;
  currentHash?: string;
  latestHash?: string;
  patchNumber?: number;
  totalPatchesApplied?: number;
  progress?: number;
  bytesDownloaded?: number;
  totalBytes?: number;
  usedPatchPath?: boolean;
  errorMessage?: string;
  url?: string;
  zstdPath?: string;
  exitCode?: number | null;
}

export interface UpdateStatusEntry {
  status: UpdateStatusType;
  message: string;
  timestamp: number;
  details?: UpdateStatusDetails;
}

export interface AppUpdateLocalInfo {
  version: string;
  hash: string;
  baseUrl: string;
  channel: string;
  name: string;
  identifier: string;
}

export interface AppUpdateRemoteInfo {
  version: string;
  hash: string;
  updateAvailable: boolean;
  updateReady: boolean;
  error: string;
}

export interface AppUpdateState {
  localInfo: AppUpdateLocalInfo | null;
  updateInfo: AppUpdateRemoteInfo | null;
  latestStatus: UpdateStatusEntry | null;
  statusHistory: UpdateStatusEntry[];
}
