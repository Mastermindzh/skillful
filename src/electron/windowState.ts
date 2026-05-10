import { readFile } from "node:fs/promises";
import path from "node:path";
import type { BrowserWindow } from "electron";
import { app, screen } from "electron";
import { atomicWriteFile } from "../main/fs";

export type SavedWindowState = {
  width: number;
  height: number;
  x?: number;
  y?: number;
};

export const MIN_WINDOW_WIDTH = 960;
export const MIN_WINDOW_HEIGHT = 640;

const DEFAULT_WINDOW_STATE = {
  width: 1320,
  height: 840,
} satisfies SavedWindowState;
const WINDOW_STATE_SAVE_DELAY_MS = 300;

function windowStatePath() {
  return path.join(app.getPath("userData"), "window-state.json");
}

function isValidWindowState(value: Partial<SavedWindowState>): value is SavedWindowState {
  return (
    typeof value.width === "number" &&
    typeof value.height === "number" &&
    value.width >= MIN_WINDOW_WIDTH &&
    value.height >= MIN_WINDOW_HEIGHT
  );
}

function serializeWindowState(bounds: {
  width: number;
  height: number;
  x?: number;
  y?: number;
}): SavedWindowState {
  return {
    width: bounds.width,
    height: bounds.height,
    ...(typeof bounds.x === "number" ? { x: bounds.x } : {}),
    ...(typeof bounds.y === "number" ? { y: bounds.y } : {}),
  };
}

function intersectsDisplay(state: SavedWindowState) {
  if (typeof state.x !== "number" || typeof state.y !== "number") return true;
  const x = state.x;
  const y = state.y;
  const windowRight = x + state.width;
  const windowBottom = y + state.height;

  return screen.getAllDisplays().some(({ workArea }) => {
    const displayRight = workArea.x + workArea.width;
    const displayBottom = workArea.y + workArea.height;
    return (
      x < displayRight && windowRight > workArea.x && y < displayBottom && windowBottom > workArea.y
    );
  });
}

export async function loadWindowState(): Promise<SavedWindowState> {
  try {
    const raw = await readFile(windowStatePath(), "utf8");
    const parsed = JSON.parse(raw) as Partial<SavedWindowState>;
    const state = isValidWindowState(parsed) ? serializeWindowState(parsed) : null;
    return state && intersectsDisplay(state) ? state : DEFAULT_WINDOW_STATE;
  } catch {
    return DEFAULT_WINDOW_STATE;
  }
}

export async function saveWindowState(window: BrowserWindow) {
  if (
    window.isDestroyed() ||
    window.isMaximized() ||
    window.isMinimized() ||
    window.isFullScreen()
  ) {
    return;
  }

  await atomicWriteFile(
    windowStatePath(),
    JSON.stringify(serializeWindowState(window.getBounds()), null, 2),
    "utf8"
  );
}

export function createWindowStateSaver(window: BrowserWindow) {
  let saveTimer: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    void saveWindowState(window);
  };

  const schedule = () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(flush, WINDOW_STATE_SAVE_DELAY_MS);
  };

  return { flush, schedule };
}
