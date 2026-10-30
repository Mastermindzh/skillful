import { useState } from "react";

/**
 * Calls `onChange` during render when `value` changes, React's "adjust state when a prop changes"
 * pattern. Unlike an effect, this avoids committing a render with stale state first.
 * Only update the calling component's own state from `onChange`.
 */
export function useOnValueChange<T>(value: T, onChange: (next: T, previous: T) => void) {
  const [previous, setPrevious] = useState(value);
  if (!Object.is(value, previous)) {
    setPrevious(value);
    onChange(value, previous);
  }
}

/** Runs `onOpen` during render each time `opened` flips to true, e.g. to reset a dialog's form. */
export function useOnDialogOpen(opened: boolean, onOpen: () => void) {
  useOnValueChange(opened, (isOpen) => {
    if (isOpen) onOpen();
  });
}
