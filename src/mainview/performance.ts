import { logRenderer, perfEnabled } from "@mainview-bridge";

function formatDetails(details: Record<string, unknown> | undefined) {
  if (!details) return "";
  return ` ${JSON.stringify(details)}`;
}

export function logRendererPerf(label: string, details?: Record<string, unknown>) {
  if (!perfEnabled) return;
  logRenderer("info", `[skillful:perf] ${label}${formatDetails(details)}`);
}

export function measureRenderer<T>(
  label: string,
  action: () => T,
  details?: (result: T) => Record<string, unknown>
): T {
  if (!perfEnabled) return action();

  const startedAt = performance.now();
  const result = action();
  logRenderer(
    "info",
    `[skillful:perf] ${label} ${(performance.now() - startedAt).toFixed(1)}ms${formatDetails(
      details?.(result)
    )}`
  );
  return result;
}
