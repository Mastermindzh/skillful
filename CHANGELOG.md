# Changelog

## 1.2.0 - 2026-xx-xx

- Added git backup sync

## 1.1.2 - 2026-05-13

- Fixed not being able to select a new collection while moving items, fixes [#1](https://github.com/Mastermindzh/skillful/issues/1)
- *DEV:* added devcontainer

## 1.1.1 - 2026-05-11

- Disabled AppImage sandbox
- Added discord icon to README
- Fixed Windows updater
- Fixed AUR deployment (hopefully... 'works on my machine')

## 1.1.0 - 2026-05-11

- Added a joyride to teach the user how to use the app

## 1.0.0 - 2026-05-10

First stable release.

### Added

- Local-first skill and agent library management using folders on disk.
- Collection creation, rename, delete, move, import, and export workflows.
- Folder import, `.skillful.zip` archive import/export, and GitHub source archive import.
- `skillful://import` deep links for repository README import buttons.
- Markdown preview and edit modes with a configurable default editor mode.
- Additional file management for screenshots, scripts, references, and other supporting assets.
- Frontmatter metadata validation for entry files with non-blocking warnings.
- Tool install, remove, and repair flows for Claude Code, Codex, GitHub Copilot, Cursor, Gemini CLI, Junie, and opencode-style destinations.
- Large-library search and filtering by collection, tool, and item kind.
- English and Dutch UI localization foundation.
- Cross-platform Electron packaging for Windows, macOS, and Linux.

### Notes

- Skillful is source-available under FSL-1.1-MIT.
- Windows and macOS builds are unsigned for now. See [docs/install.md](docs/install.md) for first-launch instructions.
- Package-managed Linux installs should be updated through the same package manager or store used for installation.
