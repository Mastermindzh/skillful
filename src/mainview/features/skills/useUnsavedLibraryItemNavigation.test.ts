import { describe, expect, it, vi } from "vitest";
import { saveThenNavigate } from "./useUnsavedLibraryItemNavigation";

describe("saveThenNavigate", () => {
  it("clears drafts and navigates once the save succeeds", async () => {
    const clearDrafts = vi.fn();
    const navigate = vi.fn();

    const navigated = await saveThenNavigate({
      saveAllFiles: async () => true,
      clearDrafts,
      navigate,
    });

    expect(navigated).toBe(true);
    expect(clearDrafts).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledOnce();
  });

  it("keeps drafts and stays put when the save fails", async () => {
    const clearDrafts = vi.fn();
    const navigate = vi.fn();

    const navigated = await saveThenNavigate({
      saveAllFiles: async () => false,
      clearDrafts,
      navigate,
    });

    expect(navigated).toBe(false);
    expect(clearDrafts).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("does not drop drafts when the save throws", async () => {
    const clearDrafts = vi.fn();
    const navigate = vi.fn();

    await expect(
      saveThenNavigate({
        saveAllFiles: async () => {
          throw new Error("disk full");
        },
        clearDrafts,
        navigate,
      })
    ).rejects.toThrow("disk full");

    expect(clearDrafts).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });
});
