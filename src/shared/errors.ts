/** Stable error codes the bun service layer raises so the UI can branch on them. */
export type AppErrorCode =
  | "skill-not-found"
  | "tool-not-found"
  | "collection-not-found"
  | "collection-exists"
  | "skill-exists"
  | "file-exists"
  | "file-not-found"
  | "invalid-name"
  | "invalid-path"
  | "unsupported-extension"
  | "archive-format-unsupported"
  | "archive-too-large"
  | "archive-entry-too-large"
  | "archive-too-many-entries"
  | "archive-symlink-rejected"
  | "archive-path-unsafe"
  | "archive-manifest-missing"
  | "settings-corrupt"
  | "git-restore-local-content"
  | "git-restore-invalid-remote"
  | "tool-install-conflict"
  | "tool-install-missing-root"
  | "rename-relink-failed"
  | "unsaved-changes"
  | "internal";

export interface SerializedAppError {
  /** Discriminator used so the UI can detect a structured error round-tripped over RPC. */
  readonly __appError: true;
  readonly code: AppErrorCode;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly details?: Readonly<Record<string, unknown>>;

  constructor(code: AppErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.details = details ? Object.freeze({ ...details }) : undefined;
  }

  toJSON(): SerializedAppError {
    return {
      __appError: true,
      code: this.code,
      message: this.message,
      ...(this.details ? { details: this.details } : {}),
    };
  }
}

export function isSerializedAppError(value: unknown): value is SerializedAppError {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<SerializedAppError>;
  return candidate.__appError === true && typeof candidate.code === "string";
}

/** Unwraps a serialized AppError back into a real instance. Useful in the webview. */
export function appErrorFromSerialized(value: SerializedAppError) {
  return new AppError(value.code, value.message, value.details ? { ...value.details } : undefined);
}

/**
 * Sentinel prefix used to smuggle an `AppError` across the desktop RPC boundary, whose
 * transport only copies `error.message` as a plain string. Pairs with `encodeAppErrorForRpc`
 * (main/bun side) and `rehydrateAppErrorFromRpc` (renderer/webview side).
 */
const RPC_APP_ERROR_SENTINEL = "__appError__:";

/** Serialise an `AppError` into a `message`-safe string for the RPC reject path. */
export function encodeAppErrorForRpc(error: AppError) {
  return `${RPC_APP_ERROR_SENTINEL}${JSON.stringify(error.toJSON())}`;
}

/**
 * If `error` is an `Error` whose message was produced by `encodeAppErrorForRpc`, return a
 * reconstructed `AppError` instance. Otherwise return `null`. This is the only correct way
 * to read `AppError.code` on the renderer side Electron's IPC transport only copies
 * `error.message` across the process boundary and discards every other property.
 *
 * `ipcRenderer.invoke` additionally prepends `Error invoking remote method '…': ` to the
 * message, so the sentinel may appear at an arbitrary offset rather than position 0.
 * We locate it with `indexOf` to tolerate that wrapping.
 */
export function rehydrateAppErrorFromRpc(error: unknown): AppError | null {
  if (!(error instanceof Error)) return null;
  const index = error.message.indexOf(RPC_APP_ERROR_SENTINEL);
  if (index < 0) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(error.message.slice(index + RPC_APP_ERROR_SENTINEL.length));
  } catch {
    return null;
  }
  if (!isSerializedAppError(parsed)) return null;
  return appErrorFromSerialized(parsed);
}
