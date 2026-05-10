import type { MouseEvent } from "react";
import { forwardRef, useCallback, useState } from "react";
import { createPortal } from "react-dom";

type ContextAnchorProps = {
  x: number;
  y: number;
};

const ContextMenuAnchor = forwardRef<HTMLDivElement, ContextAnchorProps>(
  ({ x, y, ...rest }, ref) => {
    if (typeof document === "undefined") return null;
    return createPortal(
      <div
        ref={ref}
        aria-hidden="true"
        style={{
          position: "fixed",
          left: x,
          top: y,
          width: 0,
          height: 0,
          pointerEvents: "none",
        }}
        {...rest}
      />,
      document.body
    );
  }
);
ContextMenuAnchor.displayName = "ContextMenuAnchor";

export function useContextMenuPosition() {
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const capturePosition = useCallback((event: MouseEvent) => {
    setPosition({ x: event.clientX, y: event.clientY });
  }, []);

  return { capturePosition, position, Anchor: ContextMenuAnchor };
}
