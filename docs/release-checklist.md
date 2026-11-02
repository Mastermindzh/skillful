# Release Checklist

Use this before tagging a public release.

## Automated Checks

Run these from the repository root:

```bash
bun run check
bun run test:unit
bun run test:e2e
```

Build the current platform package locally:

```bash
bun run dist
```

For targeted platform builds:

```bash
bun run dist:win
bun run dist:mac
bun run dist:linux
bun run dist:snap
bun run dist:flatpak
```

## Release Notes

The `CHANGELOG.md` section for the tagged version becomes the GitHub release notes. Relative links
and images are rewritten to the tag, so screenshots under `docs/images/` show up on the release
page. Preview the result before tagging:

```bash
node scripts/release-notes.mjs v1.3.0
```

## App Smoke Test

- Launch the packaged app.
- Confirm the app uses the expected library folder.
- Create a collection.
- Create a skill and an agent.
- Edit `SKILL.md` and `AGENT.md`.
- Confirm missing `name` or `description` frontmatter shows a non-blocking warning.
- Create, rename, and delete an extra markdown file.
- Upload, open, reveal, rename, and delete an additional file.
- Move an item between collections.
- Export a collection.
- Import the exported `.skillful.zip`.
- Import a local folder that contains skills and agents.
- Import a public GitHub repository through the Git import dialog.
- Open a `skillful://import?...` link and confirm the import dialog is prefilled.
- Search and filter by all items, skills, agents, collection, and tool.
- Switch between preview and edit mode.
- Switch language in settings and confirm the UI updates.
- Toggle success/info notification hiding.
- Add a git library, sync it, and confirm its collection appears with the git origin badge.
- Open a tool's instructions from the list header, edit and save, and confirm the file changed on disk.
- Run a git backup with tool instructions included and confirm `tool-instructions/` was pushed.
