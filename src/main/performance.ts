import { logger } from "./logger";

const enabled = process.env.SKILLFUL_PERF === "1";

function formatDetails(details: Record<string, unknown> | undefined) {
  if (!details) return "";
  return ` ${JSON.stringify(details)}`;
}

export function perfEnabled() {
  return enabled;
}

export function logPerf(label: string, details?: Record<string, unknown>) {
  if (!enabled) return;
  logger.info(`[skillful:perf] ${label}${formatDetails(details)}`);
}

export async function measureAsync<T>(
  label: string,
  action: () => Promise<T>,
  details?: (result: T) => Record<string, unknown>
): Promise<T> {
  if (!enabled) return action();

  const startedAt = performance.now();
  try {
    const result = await action();
    logger.info(
      `[skillful:perf] ${label} ${(performance.now() - startedAt).toFixed(1)}ms${formatDetails(
        details?.(result)
      )}`
    );
    return result;
  } catch (error) {
    logger.info(`[skillful:perf] ${label} failed ${(performance.now() - startedAt).toFixed(1)}ms`);
    throw error;
  }
}
