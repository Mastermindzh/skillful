import { describe, expect, test } from "vitest";
import { findSkillfulDeepLink, parseSkillfulImportDeepLink } from "./deepLinks";
import { AppError } from "./errors";

describe("parseSkillfulImportDeepLink", () => {
  test("parses repo, ref, path, and collection name", () => {
    expect(
      parseSkillfulImportDeepLink(
        "skillful://import?repo=Mastermindzh/skillful-library&ref=main&path=skills/review-pr&collection=Review%20Imports"
      )
    ).toEqual({
      repo: "Mastermindzh/skillful-library",
      ref: "main",
      path: "skills/review-pr",
      name: "Review Imports",
    });
  });

  test("ignores unknown parameters", () => {
    expect(
      parseSkillfulImportDeepLink(
        "skillful://import?repo=Mastermindzh/skillful-library&unused=value"
      )
    ).toEqual({
      repo: "Mastermindzh/skillful-library",
    });
  });

  test("rejects unsupported deep link actions", () => {
    expect(() =>
      parseSkillfulImportDeepLink("skillful://open?repo=Mastermindzh/skillful-library")
    ).toThrowError(AppError);
  });
});

describe("findSkillfulDeepLink", () => {
  test("returns the first matching argv entry", () => {
    expect(
      findSkillfulDeepLink([
        "electron",
        ".",
        "--flag",
        "skillful://import?repo=Mastermindzh/skillful-library",
      ])
    ).toBe("skillful://import?repo=Mastermindzh/skillful-library");
  });

  test("returns null when argv does not contain a deep link", () => {
    expect(findSkillfulDeepLink(["electron", ".", "--flag"])).toBeNull();
  });
});
