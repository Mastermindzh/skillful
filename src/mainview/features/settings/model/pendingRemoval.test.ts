import { describe, expect, it } from "vitest";
import { isPendingRemoval, markRowRemoval, restoreRow } from "./pendingRemoval";

type Row = { id: string; name: string; pendingRemoval?: boolean };

describe("markRowRemoval", () => {
  it("flips pendingRemoval on saved rows", () => {
    const rows: Row[] = [
      { id: "a", name: "A" },
      { id: "b", name: "B" },
    ];
    const next = markRowRemoval(rows, "b", new Set(["a", "b"]));
    expect(next).toHaveLength(2);
    expect(next[1]).toEqual({ id: "b", name: "B", pendingRemoval: true });
    expect(next[0]).toEqual({ id: "a", name: "A" });
  });

  it("filters unsaved rows out instead of marking them", () => {
    const rows: Row[] = [
      { id: "a", name: "A" },
      { id: "b", name: "B" },
    ];
    const next = markRowRemoval(rows, "b", new Set(["a"]));
    expect(next).toEqual([{ id: "a", name: "A" }]);
  });

  it("returns a fresh array reference for saved rows so React state updates", () => {
    const rows: Row[] = [{ id: "a", name: "A" }];
    const next = markRowRemoval(rows, "a", new Set(["a"]));
    expect(next).not.toBe(rows);
    expect(next[0]).not.toBe(rows[0]);
  });

  it("is a no-op for an unknown id when not in savedIds", () => {
    const rows: Row[] = [{ id: "a", name: "A" }];
    const next = markRowRemoval(rows, "missing", new Set(["a"]));
    expect(next).toEqual(rows);
  });
});

describe("restoreRow", () => {
  it("clears pendingRemoval on the matching row", () => {
    const rows: Row[] = [
      { id: "a", name: "A", pendingRemoval: true },
      { id: "b", name: "B" },
    ];
    const next = restoreRow(rows, "a");
    expect(next[0]).toEqual({ id: "a", name: "A", pendingRemoval: false });
    expect(next[1]).toEqual({ id: "b", name: "B" });
  });

  it("leaves rows untouched when no id matches", () => {
    const rows: Row[] = [{ id: "a", name: "A", pendingRemoval: true }];
    const next = restoreRow(rows, "missing");
    expect(next[0]).toEqual({ id: "a", name: "A", pendingRemoval: true });
  });
});

describe("isPendingRemoval", () => {
  it("is true only when the row exists and is pending", () => {
    const rows: Row[] = [
      { id: "a", name: "A", pendingRemoval: true },
      { id: "b", name: "B" },
    ];
    expect(isPendingRemoval(rows, "a")).toBe(true);
    expect(isPendingRemoval(rows, "b")).toBe(false);
    expect(isPendingRemoval(rows, "missing")).toBe(false);
  });
});
