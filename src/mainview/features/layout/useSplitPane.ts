import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const STORAGE_KEY = "skillful:list-pane-width";
const DEFAULT_WIDTH = 640;
const MIN_LIST_WIDTH = 260;
const MAX_LIST_WIDTH = 760;
const KEYBOARD_STEP = 24;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function readStoredWidth() {
  if (typeof window === "undefined") return DEFAULT_WIDTH;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return DEFAULT_WIDTH;
    return clamp(parsed, MIN_LIST_WIDTH, MAX_LIST_WIDTH);
  } catch {
    return DEFAULT_WIDTH;
  }
}

export function useSplitPane(enabled: boolean) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(readStoredWidth);
  const [isDragging, setIsDragging] = useState(false);

  const setClampedWidth = useCallback((nextWidth: number) => {
    setWidth(clamp(nextWidth, MIN_LIST_WIDTH, MAX_LIST_WIDTH));
  }, []);

  const startDragging = useCallback(() => {
    if (!enabled) return;
    setIsDragging(true);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setIsDragging(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, String(width));
    } catch {
      // Ignore storage quota / privacy-mode failures the width will fall back to the default on next load.
    }
  }, [width]);

  useEffect(() => {
    if (!enabled || !isDragging) return;

    const handlePointerMove = (event: PointerEvent) => {
      const containerRect = containerRef.current?.getBoundingClientRect();
      if (!containerRect) return;
      setClampedWidth(event.clientX - containerRect.left);
    };

    const stopDragging = () => {
      setIsDragging(false);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopDragging);
    window.addEventListener("pointercancel", stopDragging);
    document.body.classList.add("split-resizing");

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopDragging);
      window.removeEventListener("pointercancel", stopDragging);
      document.body.classList.remove("split-resizing");
    };
  }, [enabled, isDragging, setClampedWidth]);

  const separatorProps = useMemo(
    () => ({
      onPointerDown: startDragging,
      onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => {
        if (!enabled) return;
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          setClampedWidth(width - KEYBOARD_STEP);
        }
        if (event.key === "ArrowRight") {
          event.preventDefault();
          setClampedWidth(width + KEYBOARD_STEP);
        }
      },
      "aria-valuemin": MIN_LIST_WIDTH,
      "aria-valuemax": MAX_LIST_WIDTH,
      "aria-valuenow": width,
    }),
    [enabled, setClampedWidth, startDragging, width]
  );

  return {
    containerRef,
    isDragging,
    listWidth: width,
    separatorProps,
  };
}
