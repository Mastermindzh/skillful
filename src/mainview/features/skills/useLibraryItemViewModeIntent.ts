import { useCallback, useState } from "react";
import type { EditorViewMode } from "../../../shared/types";

export type ViewMode = EditorViewMode;

export type ViewModeIntent = {
  mode: ViewMode;
  token: number;
};

export function useLibraryItemViewModeIntent() {
  const [viewModeIntent, setViewModeIntent] = useState<ViewModeIntent>({
    mode: "preview",
    token: 0,
  });

  const pushViewModeIntent = useCallback((mode: ViewMode) => {
    setViewModeIntent((current) => ({ mode, token: current.token + 1 }));
  }, []);

  return { pushViewModeIntent, viewModeIntent };
}
