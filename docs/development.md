# Development

## Requirements

- [Bun](https://bun.sh/)

## Install Dependencies

```bash
bun install
```

## Run Locally

```bash
bun run dev
```

For Vite HMR with Electron:

```bash
bun run dev:hmr
```

## Checks

```bash
bun run check
bun run test:unit
bun run test:e2e
```

Watch the browser run the E2E suite:

```bash
bun run test:e2e:headed
```

Run slower for debugging:

```bash
bun run test:e2e:debug
```

Open the Playwright report:

```bash
bun run test:e2e:report
```

## Build

```bash
bun run build
```

Package locally without publishing:

```bash
bun run dist
```

Platform-specific packaging scripts:

```bash
bun run dist:linux
bun run dist:snap
bun run dist:flatpak
bun run dist:win
bun run dist:mac
```

Flatpak packaging requires the host tools to be installed. On Debian/Ubuntu:

```bash
sudo apt-get install flatpak flatpak-builder elfutils
```

On Arch:

```bash
sudo pacman -S flatpak flatpak-builder elfutils
```

If a local Flatpak build appears to hang after `building target=flatpak`, rerun it with Flatpak bundler logs enabled:

```bash
bun run dist:flatpak:debug
```

## Project Structure

```text
src/mainview/           React renderer
src/main/               Electron main process services
src/desktop/            runtime-agnostic orchestrator wiring main process behavior to requests
src/electron/           Electron entry, preload, updater, and shell integration
src/shared/             shared contracts and types
tests/e2e/              Playwright browser-harness tests
website/                skillful.md sources
assets/                 icons and package metadata
```

## Environment Variables

Most users do not need these. They are useful for development and diagnostics.

| Variable | Effect |
| --- | --- |
| `SKILLFUL_PERF=1` | Emits `[skillful:perf] <label> <ms>` lines for scans, RPC calls, and key renderer derivations. |
| `SKILLFUL_CONFIG_NAME` | Overrides the settings/library directory name. The dev scripts set this to `skillful-dev` so local development uses `~/.config/skillful-dev` on Linux instead of your real `~/.config/skillful` library. |
| `SKILLFUL_ELECTRON_DEVTOOLS=1` | Opens Electron DevTools in development. |
| `SKILLFUL_ELECTRON_LOAD_FILE=1` | Loads the built renderer from disk for Electron dev runs. |
| `XDG_CONFIG_HOME` | Linux only. Overrides the default `~/.config` location for Skillful's settings/library directory. |
| `APPDATA` | Windows only. Overrides the default `%APPDATA%` location for Skillful's settings/library directory. |
| `HOME` | Used as the fallback home directory when computing default paths. |

Debug and diagnostic logs should stay in English. User-facing renderer copy should go through the i18n layer.
