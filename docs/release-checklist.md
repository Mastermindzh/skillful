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
