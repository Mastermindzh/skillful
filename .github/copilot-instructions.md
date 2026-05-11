# Skillful — Copilot Instructions

Skillful is an Electron + React + TypeScript desktop app for managing
folder-based AI skills and agents on disk. The filesystem is the source of
truth. Keep changes small and aligned with the existing architecture.

## Architecture invariants

- `src/main/` owns all filesystem and child-process I/O (Node side).
- `src/electron/` is the process boundary (main process entry, preload, updater).
- `src/shared/` holds types, schemas, RPC contracts, and pure helpers used by
  both sides. No `node:*` imports that won't run in the renderer.
- `src/mainview/` is the React renderer. It MUST NOT import `node:fs`,
  `node:path`, `electron`, or anything from `src/main/` directly.
- All cross-process communication goes through the typed RPC in
  `src/shared/rpc.ts` and `src/shared/rpcAdapter.ts`, exposed to the renderer
  via `src/mainview/bridge.ts`. Do not add ad-hoc `ipcRenderer.invoke` calls.

## Data and state

- Library/skill/agent data is represented by the typed structures in
  `src/shared/types.ts`, `src/shared/schemas.ts`, `src/shared/library.ts`,
  and `src/shared/frontmatter.ts`. Never represent rows as positional
  `string[]` / tuples; use named fields.
- Validate frontmatter through the existing schema layer; do not parse
  metadata ad-hoc in UI code.
- Renderer state lives in feature-scoped hooks under
  `src/mainview/features/<area>/`. Do not add view-specific state to
  `App.tsx` or to a shared mega-hook.
- A new feature should add files to a feature folder, not grow an existing
  hook past a few hundred lines or add another branch to a shared switch.

## Tool installs

- All tool install destinations are defined in `src/shared/toolPresets.ts`.
  Add new tools there with a preset; do not add `if (tool === "...")`
  branches scattered through install code.
- Installs must not duplicate the source library — they reference or link
  files in the user's library directory.

## Concurrency

- Long-running work (scans, imports, installs) runs in `src/main/` and
  returns results through the RPC layer.
- The renderer never mutates state from a fire-and-forget background task;
  results come back as RPC responses or typed events and are applied through
  React state.

## Scope

Skillful is intentionally narrow:

- folder-based skills (`SKILL.md`) and agents (`AGENT.md`)
- collections as content groups, tools as install destinations
- offline, no account, no cloud storage, no proprietary database

Do NOT add: cloud sync, accounts, telemetry, a built-in chat UI, or features
that move the source of truth off the filesystem. Reject scope expansion that
duplicates functionality of the AI tools Skillful installs into.

## Code standards

- Indent with 2 spaces. Biome is the formatter/linter; respect `biome.json`.
- Prefer Mantine components over rebuilding primitives.
- Keep filesystem helpers in `src/main/`, not in UI components.
- Add or update tests for user-facing behavior changes
  (`*.test.ts` co-located, plus Playwright e2e under `tests/e2e/` when
  relevant).
- Do not add backward-compatibility shims for unpublished formats.

## Checks before considering a change done

- `bun run check`
- `bun run test:e2e` when behavior changed
