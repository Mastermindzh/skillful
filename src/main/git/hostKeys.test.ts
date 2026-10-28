import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { scanGitLibraryHostKey, trustGitLibraryHost } from "./hostKeys";

const runCommand = vi.hoisted(() => vi.fn());
vi.mock("./command", () => ({ runCommand }));

const ED25519_LINE = "github.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAFIRST";
const ROTATED_LINE = "github.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAROTATED";

let home: string;
let originalHome: string | undefined;

/** Mirrors the two-call shape of a scan: ssh-keyscan, then ssh-keygen over its output. */
function mockScan(line: string, fingerprint: string) {
  runCommand.mockImplementation(async (command: string) => {
    if (command === "ssh-keyscan")
      return { stdout: `# github.com:22 SSH-2.0\n${line}\n`, stderr: "" };
    if (command === "ssh-keygen") return { stdout: fingerprint, stderr: "" };
    throw new Error(`unexpected command: ${command}`);
  });
}

function knownHostsPath() {
  return path.join(home, ".ssh", "known_hosts");
}

beforeEach(async () => {
  home = await mkdtemp(path.join(tmpdir(), "skillful-known-hosts-"));
  originalHome = process.env.HOME;
  process.env.HOME = home;
  runCommand.mockReset();
});

afterEach(async () => {
  if (originalHome === undefined) delete process.env.HOME;
  else process.env.HOME = originalHome;
  await rm(home, { recursive: true, force: true });
});

describe("scanGitLibraryHostKey", () => {
  it("returns the fingerprint for the scanned key", async () => {
    mockScan(ED25519_LINE, "256 SHA256:abc123 github.com (ED25519)");

    await expect(scanGitLibraryHostKey("github.com")).resolves.toEqual({
      host: "github.com",
      keyType: "ED25519",
      fingerprint: "SHA256:abc123",
    });
  });

  it("refuses host names that could be read as ssh options", async () => {
    await expect(scanGitLibraryHostKey("-oProxyCommand=touch /tmp/pwned")).rejects.toMatchObject({
      code: "invalid-name",
    });
    expect(runCommand).not.toHaveBeenCalled();
  });

  it("returns null when the host offers no key", async () => {
    runCommand.mockResolvedValue({ stdout: "", stderr: "" });

    await expect(scanGitLibraryHostKey("github.com")).resolves.toBeNull();
  });

  it("returns null when the fingerprint cannot be computed", async () => {
    runCommand.mockImplementation(async (command: string) => {
      if (command === "ssh-keyscan") return { stdout: `${ED25519_LINE}\n`, stderr: "" };
      throw new Error("ssh-keygen unavailable");
    });

    await expect(scanGitLibraryHostKey("github.com")).resolves.toBeNull();
  });
});

describe("trustGitLibraryHost", () => {
  const approved = {
    host: "github.com",
    keyType: "ED25519",
    fingerprint: "SHA256:abc123",
  };

  it("writes the exact line whose fingerprint was verified", async () => {
    mockScan(ED25519_LINE, "256 SHA256:abc123 github.com (ED25519)");

    await trustGitLibraryHost(approved);

    await expect(readFile(knownHostsPath(), "utf8")).resolves.toBe(`${ED25519_LINE}\n`);
  });

  it("refuses to write when the host key changed since it was shown", async () => {
    mockScan(ROTATED_LINE, "256 SHA256:rotated github.com (ED25519)");

    await expect(trustGitLibraryHost(approved)).rejects.toMatchObject({
      code: "internal",
    });
    await expect(readFile(knownHostsPath(), "utf8")).rejects.toThrow();
  });

  it("never writes a key it did not fingerprint, even if the host rotates mid-trust", async () => {
    // Verifying one scan and appending a second would store ROTATED_LINE under the fingerprint
    // the user approved for ED25519_LINE.
    let keyscans = 0;
    runCommand.mockImplementation(async (command: string) => {
      if (command === "ssh-keyscan") {
        keyscans += 1;
        return {
          stdout: `${keyscans === 1 ? ED25519_LINE : ROTATED_LINE}\n`,
          stderr: "",
        };
      }
      return { stdout: "256 SHA256:abc123 github.com (ED25519)", stderr: "" };
    });

    await trustGitLibraryHost(approved);

    expect(keyscans).toBe(1);
    await expect(readFile(knownHostsPath(), "utf8")).resolves.toBe(`${ED25519_LINE}\n`);
  });

  it("does not trust a host whose fingerprint could not be computed", async () => {
    runCommand.mockImplementation(async (command: string) => {
      if (command === "ssh-keyscan") return { stdout: `${ED25519_LINE}\n`, stderr: "" };
      throw new Error("ssh-keygen unavailable");
    });

    await expect(trustGitLibraryHost({ ...approved, fingerprint: "" })).rejects.toMatchObject({
      code: "internal",
    });
  });

  it("preserves existing entries and does not duplicate a trusted key", async () => {
    mockScan(ED25519_LINE, "256 SHA256:abc123 github.com (ED25519)");
    const existing = "gitlab.com ssh-ed25519 AAAAEXISTING";
    await mkdir(path.join(home, ".ssh"), { recursive: true });
    await writeFile(knownHostsPath(), `${existing}\n`, "utf8");

    await trustGitLibraryHost(approved);
    await trustGitLibraryHost(approved);

    const lines = (await readFile(knownHostsPath(), "utf8")).split("\n").filter(Boolean);
    expect(lines).toEqual([existing, ED25519_LINE]);
  });

  it("separates the appended key when the file has no trailing newline", async () => {
    mockScan(ED25519_LINE, "256 SHA256:abc123 github.com (ED25519)");
    await mkdir(path.join(home, ".ssh"), { recursive: true });
    await writeFile(knownHostsPath(), "gitlab.com ssh-ed25519 AAAAEXISTING", "utf8");

    await trustGitLibraryHost(approved);

    const lines = (await readFile(knownHostsPath(), "utf8")).split("\n").filter(Boolean);
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe(ED25519_LINE);
  });
});
