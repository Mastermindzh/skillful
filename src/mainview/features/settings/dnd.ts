import type { DragEvent } from "react";

export function preventFileUriDrop(event: DragEvent<HTMLElement>) {
  event.preventDefault();
}
