import { describe, expect, it } from "vitest";
import {
  AppError,
  appErrorFromSerialized,
  encodeAppErrorForRpc,
  isSerializedAppError,
  rehydrateAppErrorFromRpc,
} from "./errors";

describe("AppError", () => {
  it("preserves code, message, and details", () => {
    const error = new AppError("skill-not-found", "gone", { id: "abc" });
    expect(error.code).toBe("skill-not-found");
    expect(error.message).toBe("gone");
    expect(error.details).toEqual({ id: "abc" });
  });

  it("freezes details so callers cannot mutate them after the fact", () => {
    const error = new AppError("invalid-name", "bad", { field: "name" });
    expect(Object.isFrozen(error.details)).toBe(true);
  });

  it("omits details from JSON when absent", () => {
    const error = new AppError("internal", "oops");
    expect(error.toJSON()).toEqual({
      __appError: true,
      code: "internal",
      message: "oops",
    });
  });

  it("round-trips cleanly through JSON.stringify + appErrorFromSerialized", () => {
    const original = new AppError("archive-too-large", "too big", { size: 9001 });
    const encoded = JSON.parse(JSON.stringify(original));
    expect(isSerializedAppError(encoded)).toBe(true);
    const decoded = appErrorFromSerialized(encoded);
    expect(decoded).toBeInstanceOf(AppError);
    expect(decoded.code).toBe("archive-too-large");
    expect(decoded.message).toBe("too big");
    expect(decoded.details).toEqual({ size: 9001 });
  });
});

describe("isSerializedAppError", () => {
  it("rejects arbitrary objects", () => {
    expect(isSerializedAppError(null)).toBe(false);
    expect(isSerializedAppError({})).toBe(false);
    expect(isSerializedAppError({ code: "x" })).toBe(false);
    expect(isSerializedAppError({ __appError: true })).toBe(false);
    expect(isSerializedAppError({ __appError: true, code: 42 })).toBe(false);
  });

  it("accepts a correctly-shaped serialized error", () => {
    expect(
      isSerializedAppError({
        __appError: true,
        code: "skill-not-found",
        message: "gone",
      })
    ).toBe(true);
  });
});

describe("encodeAppErrorForRpc / rehydrateAppErrorFromRpc", () => {
  it("round-trips an AppError through the sentinel-prefixed string transport", () => {
    const original = new AppError("invalid-name", "bad name", { field: "title" });
    const wire = encodeAppErrorForRpc(original);
    expect(typeof wire).toBe("string");
    const thrown = new Error(wire);
    const rehydrated = rehydrateAppErrorFromRpc(thrown);
    expect(rehydrated).toBeInstanceOf(AppError);
    expect(rehydrated?.code).toBe("invalid-name");
    expect(rehydrated?.message).toBe("bad name");
    expect(rehydrated?.details).toEqual({ field: "title" });
  });

  it("returns null for non-sentinel errors", () => {
    expect(rehydrateAppErrorFromRpc(new Error("plain"))).toBeNull();
    expect(rehydrateAppErrorFromRpc("string error")).toBeNull();
    expect(rehydrateAppErrorFromRpc(null)).toBeNull();
  });

  it("rehydrates when the sentinel is embedded after an Electron IPC prefix", () => {
    const original = new AppError("skill-not-found", "nope", { id: "abc" });
    const wire = encodeAppErrorForRpc(original);
    // Electron's `ipcRenderer.invoke` prepends this wrapper to the original message.
    const thrown = new Error(`Error invoking remote method 'skillful:request': ${wire}`);
    const rehydrated = rehydrateAppErrorFromRpc(thrown);
    expect(rehydrated).toBeInstanceOf(AppError);
    expect(rehydrated?.code).toBe("skill-not-found");
    expect(rehydrated?.message).toBe("nope");
    expect(rehydrated?.details).toEqual({ id: "abc" });
  });
});
