import { AppError, encodeAppErrorForRpc } from "./errors";

type AnyAsyncHandler = (...args: never[]) => Promise<unknown> | unknown;

/**
 * Wraps every function in a main-process RPC request handler record so any thrown `AppError`
 * is re-thrown with its `code` + `details` smuggled through `error.message`. Electron's
 * `ipcRenderer.invoke` transport only copies `error.message` across the boundary, so this
 * sentinel-based encoding is the only way to preserve the structured error on the renderer
 * side (where `rehydrateAppErrorFromRpc` decodes it back into an `AppError` instance).
 *
 * Non-`AppError` throws pass through untouched so generic JS errors still surface normally.
 */
export function wrapRequestHandlersWithAppErrorEncoding<
  T extends Record<string, AnyAsyncHandler | undefined>,
>(handlers: T): T {
  const wrapped: Record<string, AnyAsyncHandler | undefined> = {};
  for (const [name, handler] of Object.entries(handlers)) {
    if (typeof handler !== "function") {
      wrapped[name] = handler;
      continue;
    }
    const original = handler as (...args: unknown[]) => Promise<unknown> | unknown;
    wrapped[name] = (async (...args: unknown[]) => {
      try {
        return await original(...args);
      } catch (error) {
        if (error instanceof AppError) {
          throw new Error(encodeAppErrorForRpc(error));
        }
        throw error;
      }
    }) as AnyAsyncHandler;
  }
  return wrapped as T;
}
