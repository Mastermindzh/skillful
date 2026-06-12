import { appRpc } from "@mainview-bridge";
import { useCallback, useMemo, useState } from "react";
import { presetInstallRoots, toolPresetById } from "../../../../shared/toolPresets";
import type { AppSettings } from "../../../../shared/types";
import { isPendingRemoval, markRowRemoval, restoreRow } from "../model/pendingRemoval";
import {
  availableToolPresets,
  buildToolRows,
  createToolRow,
  sameTools,
  type ToolRow,
  toolRowFromPreset,
  validateToolRows,
} from "../model/tools";

export function useToolSettingsState(appSettings: AppSettings | null) {
  const [toolRows, setToolRows] = useState(buildToolRows([]));
  const [activeToolRowId, setActiveToolRowId] = useState<string | null>(null);
  const validation = useMemo(() => validateToolRows(toolRows), [toolRows]);
  const availablePresets = useMemo(() => availableToolPresets(toolRows), [toolRows]);
  const dirty = useMemo(
    () => !sameTools(validation.tools, appSettings?.tools ?? []),
    [appSettings?.tools, validation.tools]
  );

  const reset = useCallback((settings: AppSettings | null) => {
    setToolRows(buildToolRows(settings?.tools ?? []));
    setActiveToolRowId(null);
  }, []);

  const updateRow = useCallback((id: string, field: keyof ToolRow, value: string) => {
    setToolRows((currentRows) =>
      currentRows.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    );
  }, []);

  const appendAndOpenToolRow = useCallback((tool: ToolRow) => {
    setToolRows((currentRows) => {
      if (isPendingRemoval(currentRows, tool.id)) {
        return restoreRow(currentRows, tool.id);
      }
      return [...currentRows, tool];
    });
    setActiveToolRowId(tool.id);
  }, []);

  const addRow = useCallback(() => {
    appendAndOpenToolRow(createToolRow());
  }, [appendAndOpenToolRow]);

  const pickInstallFolder = useCallback(
    async (id: string, field: "skillInstallRoot" | "agentInstallRoot") => {
      const selectedPath = await appRpc.request.pickToolInstallFolder();
      if (!selectedPath) return null;
      setToolRows((currentRows) =>
        currentRows.map((row) => (row.id === id ? { ...row, [field]: selectedPath } : row))
      );
      setActiveToolRowId(id);
      return selectedPath;
    },
    []
  );

  const addPreset = useCallback(
    (presetId: string) => {
      const preset = toolPresetById(presetId);
      if (!preset) return;
      const suggestedRoots = appSettings
        ? presetInstallRoots(preset, appSettings.homeDirectory, appSettings.platform)
        : { skill: [], agent: [] };
      const tool = toolRowFromPreset(preset, {
        skill: suggestedRoots.skill[0] ?? "",
        agent: suggestedRoots.agent[0] ?? "",
      });
      appendAndOpenToolRow(tool);
    },
    [appSettings, appendAndOpenToolRow]
  );

  const removeRow = useCallback(
    (id: string) => {
      const savedToolIds = new Set((appSettings?.tools ?? []).map((tool) => tool.id));
      setToolRows((currentRows) => markRowRemoval(currentRows, id, savedToolIds));
      setActiveToolRowId((currentId) => (currentId === id ? null : currentId));
    },
    [appSettings?.tools]
  );

  const restore = useCallback((id: string) => {
    setToolRows((currentRows) => restoreRow(currentRows, id));
    setActiveToolRowId(id);
  }, []);

  return {
    activeRowId: activeToolRowId,
    addPreset,
    addRow,
    availablePresets,
    dirty,
    pickInstallFolder,
    removeRow,
    reset,
    restoreRow: restore,
    rows: toolRows,
    setActiveRowId: setActiveToolRowId,
    updateRow,
    validation,
  };
}
