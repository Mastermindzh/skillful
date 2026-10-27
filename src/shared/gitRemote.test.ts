import { describe, expect, it } from "vitest";
import { formatGitRemoteLabel, parseScpRemote } from "./gitRemote";

describe("parseScpRemote", () => {
  it("splits user@host:path", () => {
    expect(parseScpRemote("git@github.com:you/skills.git")).toEqual({
      host: "github.com",
      path: "you/skills.git",
    });
  });

  it("accepts a remote without a user", () => {
    expect(parseScpRemote("example.com:skills")).toEqual({
      host: "example.com",
      path: "skills",
    });
  });

  it("rejects URL-style and local path remotes", () => {
    expect(parseScpRemote("ssh://git@example.com/you/skills.git")).toBeNull();
    expect(parseScpRemote("https://github.com/you/skills")).toBeNull();
    expect(parseScpRemote("/srv/git/skills.git")).toBeNull();
  });
});

describe("formatGitRemoteLabel", () => {
  it("condenses an scp-style ssh remote", () => {
    expect(formatGitRemoteLabel("git@github.com:you/team-skills.git")).toBe(
      "github.com:you/team-skills",
    );
  });

  it("condenses an https remote", () => {
    expect(
      formatGitRemoteLabel("https://github.com/frontlinersnl/skills"),
    ).toBe("github.com:frontlinersnl/skills");
  });

  it("drops the port and credentials from an ssh:// remote", () => {
    expect(
      formatGitRemoteLabel("ssh://git@git.example.com:2222/you/skills.git"),
    ).toBe("git.example.com:you/skills");
  });

  it("appends the branch when one is given", () => {
    expect(
      formatGitRemoteLabel("https://github.com/you/skills.git", "main"),
    ).toBe("github.com:you/skills@main");
  });

  it("ignores a blank branch", () => {
    expect(formatGitRemoteLabel("https://github.com/you/skills", "  ")).toBe(
      "github.com:you/skills",
    );
  });

  it("falls back to the original value when it cannot be parsed", () => {
    expect(formatGitRemoteLabel("not a remote")).toBe("not a remote");
  });

  it("returns an empty string for a blank remote", () => {
    expect(formatGitRemoteLabel("   ")).toBe("");
  });

  it("keeps a local path remote intact", () => {
    expect(formatGitRemoteLabel("/srv/git/skills.git")).toBe(
      "/srv/git/skills.git",
    );
  });
});
