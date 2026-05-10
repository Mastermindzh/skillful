# Security Policy

## Supported Versions

Security fixes are only guaranteed for the latest released version and the current `master` branch.
Older versions will not receive fixes.

## Reporting a Vulnerability

If you discover a security issue, I'd prefer it if you messaged me directly and gave me time to fix it before going public to protect the users.

Please include:

- a clear description of the issue
- affected versions or commit ranges if known
- reproduction steps or a proof of concept if safe to share
- impact assessment if you have one

I will review the report, confirm impact, and decide on a fix.

## Disclosure

Please avoid public disclosure until a fix or mitigation is available if you can.
Once resolved, the issue can be documented publicly in the repository or release notes if desired.

## Importing collection archives

Skillful can import collections from `.zip` archives produced by the export flow. Archives can
come from untrusted sources, so the importer enforces several hard limits and validation steps:

- **Path traversal.** Every archive entry path is normalized and rejected if it escapes the
  archive root (no absolute paths, no `..` segments, no Windows drive letters). Symlinks are
  refused.
- **Zip-bomb / resource exhaustion caps.** Imports fail fast when any of the following are
  exceeded: 256 MB compressed on disk, 256 MB inflated total, 100 MB per entry, 10,000 entries.
- **Manifest validation.** The archive must contain a valid `skillful.collection` manifest
  (format + version 1) and an accompanying collection folder; anything else is refused.
- **Filesystem writes.** Extraction goes through the same path-segment validator used by the
  rest of the app, so entry names cannot contain reserved or platform-unsafe characters.

If you find a way to bypass any of these, please report it via the channel above before
disclosing publicly.
