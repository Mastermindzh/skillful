import { describe, expect, it } from "vitest";
import { installFolderNameFromTitle, slugFromText, titleFromPathSegment } from "./library";

describe("slugFromText", () => {
  it("produces a lowercase hyphenated slug from ASCII input", () => {
    expect(slugFromText("Hello World!")).toBe("hello-world");
  });

  it("drops straight and curly quotes entirely", () => {
    expect(slugFromText('Bob\'s "awesome" skill')).toBe("bobs-awesome-skill");
  });

  it("collapses multiple non-word characters into a single hyphen", () => {
    expect(slugFromText("foo   ___ bar ...")).toBe("foo-bar");
  });

  it("trims leading and trailing hyphens", () => {
    expect(slugFromText("--Alpha--Beta--")).toBe("alpha-beta");
  });

  it("preserves unicode letters instead of collapsing them to a single hyphen", () => {
    // Prior behaviour: /[^a-z0-9]+/ would strip these entirely, leaving an empty slug.
    expect(slugFromText("日本語のスキル")).toBe("日本語のスキル");
    expect(slugFromText("Škola Čínštiny")).toBe("škola-čínštiny");
    expect(slugFromText("Café au lait")).toBe("café-au-lait");
  });

  it("preserves unicode digits", () => {
    expect(slugFromText("версия ١٢٣")).toBe("версия-١٢٣");
  });

  it("returns an empty string when the input has no letters or digits", () => {
    expect(slugFromText("---")).toBe("");
    expect(slugFromText("   ")).toBe("");
  });
});

describe("titleFromPathSegment", () => {
  it("replaces separators with spaces and title-cases each word", () => {
    expect(titleFromPathSegment("hello-world")).toBe("Hello World");
    expect(titleFromPathSegment("my_skill.folder")).toBe("My Skill Folder");
  });

  it("leaves already-cased words alone beyond the first character", () => {
    expect(titleFromPathSegment("MyAwesomeSkill")).toBe("MyAwesomeSkill");
  });
});

describe("installFolderNameFromTitle", () => {
  it("uses a hyphenated slug for install folder names", () => {
    expect(installFolderNameFromTitle("Review Pull Request", "review-pr")).toBe(
      "review-pull-request"
    );
  });

  it("falls back when the title cannot produce a slug", () => {
    expect(installFolderNameFromTitle("---", "review-pr")).toBe("review-pr");
  });
});
