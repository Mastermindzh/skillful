import type { LibraryItemToolStatus } from "../../../shared/types";
import type { AppTranslate } from "../../i18n/i18n";

const summaryStates: LibraryItemToolStatus["state"][] = [
  "installed",
  "unmanaged",
  "broken",
  "conflict",
];

export function countToolStatuses(statuses: LibraryItemToolStatus[]) {
  return statuses.reduce(
    (counts, status) => {
      counts[status.state] += 1;
      return counts;
    },
    {
      "not-installed": 0,
      installed: 0,
      unmanaged: 0,
      broken: 0,
      conflict: 0,
    } satisfies Record<LibraryItemToolStatus["state"], number>
  );
}

export function summarizeToolStatuses(statuses: LibraryItemToolStatus[], t: AppTranslate) {
  const counts = countToolStatuses(statuses);
  return summaryStates
    .map((state) => ({
      state,
      count: counts[state],
      label: toolStatusLabel(state, t),
    }))
    .filter((item) => item.count > 0);
}

export function toolStatusLabel(state: LibraryItemToolStatus["state"], t: AppTranslate) {
  switch (state) {
    case "installed":
      return t("tool.status.installed");
    case "unmanaged":
      return t("tool.status.unmanaged");
    case "broken":
      return t("tool.status.broken");
    case "conflict":
      return t("tool.status.conflict");
    default:
      return t("tool.status.notInstalled");
  }
}

export function toolStatusColor(state: LibraryItemToolStatus["state"]) {
  switch (state) {
    case "installed":
      return "green";
    case "unmanaged":
      return "yellow";
    case "broken":
      return "orange";
    case "conflict":
      return "red";
    default:
      return "gray";
  }
}

export function toolActionLabel(state: LibraryItemToolStatus["state"], t: AppTranslate) {
  switch (state) {
    case "installed":
      return t("tool.action.remove");
    case "broken":
      return t("tool.action.repair");
    case "conflict":
      return t("tool.action.blocked");
    case "unmanaged":
      return t("tool.action.adopt");
    default:
      return t("tool.action.install");
  }
}
