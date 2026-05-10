import { describe, expect, it } from "vitest";
import { AppError, rehydrateAppErrorFromRpc } from "./errors";
import { wrapRequestHandlersWithAppErrorEncoding } from "./rpcAdapter";

describe("wrapRequestHandlersWithAppErrorEncoding", () => {
  it("passes through resolved values unchanged", async () => {
    const handlers = wrapRequestHandlersWithAppErrorEncoding({
      echo: async (args: { value: string }) => ({ result: args.value }),
    });
    await expect(handlers.echo({ value: "hi" })).resolves.toEqual({ result: "hi" });
  });

  it("re-throws AppError as a plain Error whose message can be rehydrated end-to-end", async () => {
    const handlers = wrapRequestHandlersWithAppErrorEncoding({
      boom: async () => {
        throw new AppError("skill-not-found", "nope", { id: "abc" });
      },
    });

    // Simulate the IPC transport: it copies `error.message` across the process boundary as
    // a plain string, so the renderer receives `new Error(message)` and nothing else.
    let caught: unknown;
    try {
      await handlers.boom();
    } catch (error) {
      caught = error instanceof Error ? new Error(error.message) : error;
    }

    const rehydrated = rehydrateAppErrorFromRpc(caught);
    expect(rehydrated).toBeInstanceOf(AppError);
    expect(rehydrated?.code).toBe("skill-not-found");
    expect(rehydrated?.message).toBe("nope");
    expect(rehydrated?.details).toEqual({ id: "abc" });
  });

  it("passes non-AppError throws through untouched", async () => {
    const handlers = wrapRequestHandlersWithAppErrorEncoding({
      boom: async () => {
        throw new TypeError("something else");
      },
    });
    await expect(handlers.boom()).rejects.toBeInstanceOf(TypeError);
    await expect(handlers.boom()).rejects.toThrow("something else");
  });

  it("ignores non-function entries on the handler record", () => {
    const handlers = wrapRequestHandlersWithAppErrorEncoding({
      echo: async () => 1,
      missing: undefined,
    });
    expect(handlers.missing).toBeUndefined();
    expect(typeof handlers.echo).toBe("function");
  });
});
