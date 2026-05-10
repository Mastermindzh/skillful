import { describe, expect, it } from "vitest";
import { validateScanRootRows } from "./scanRoots";

describe("validateScanRootRows", () => {
  it("excludes rows marked for removal from the saved roots and never blocks save", () => {
    const validation = validateScanRootRows([
      { id: "kept", path: "/abs/saved" },
      // Pending row with an invalid relative path would normally fail validation.
      { id: "pending", path: "relative/bad", pendingRemoval: true },
    ]);

    expect(validation.hasErrors).toBe(false);
    expect(validation.byId.pending).toBeNull();
    expect(validation.cleanedRoots).toEqual(["/abs/saved"]);
  });
});
