import { useCallback, useState } from "react";

/**
 * Holds one action while a prompt (e.g. "save or discard changes?") is open. `take` clears it and
 * hands it back, so the caller decides whether it still runs.
 */
export function usePendingAction() {
  const [action, setAction] = useState<(() => void) | null>(null);

  // Wrapped because a function passed to a state setter would be called as an updater.
  const defer = useCallback((next: () => void) => setAction(() => next), []);
  const cancel = useCallback(() => setAction(null), []);
  const take = useCallback(() => {
    setAction(null);
    return action;
  }, [action]);

  return { pending: action !== null, defer, cancel, take };
}
