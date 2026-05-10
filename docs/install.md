# Installing Skillful

Download releases from:

- <https://github.com/Mastermindzh/skillful/releases/latest>

The product website is:

- <https://skillful.md>

> **Heads up: builds are unsigned.** Skillful is a free side project and code-signing
> certificates ($300+/year) aren't justified yet. macOS and Windows will show a one-time
> "unverified developer" / SmartScreen warning the first time you run the app. The
> per-platform sections below explain how to get past it. Linux is unaffected. The full
> source and CI build pipeline are public, so you can rebuild from any tag and compare
> SHA-512 hashes against the published `latest-*.yml` if you want to verify the binary
> independently.

## Windows

Use the Windows installer from the latest GitHub Release.

Recommended artifact:

```text
Skillful Setup *.exe
```

The installer adds normal desktop integration such as shortcuts, app protocol registration, and icons.

### Unsigned installer warning

Windows SmartScreen will show "Windows protected your PC - Unrecognized app" the first
time you run the installer. Click **More info**, then **Run anyway**. SmartScreen does
not re-prompt on subsequent launches once the app is installed.

## macOS

Use the macOS DMG from the latest GitHub Release.

Recommended artifact:

```text
Skillful-*.dmg
```

Drag Skillful into Applications, then launch it like a normal desktop app.

### Unsigned app warning

The first launch will fail with "Skillful is damaged and can't be opened" or "cannot be
opened because the developer cannot be verified". The app is not damaged, macOS just
won't run unsigned downloads by default. Two ways through:

```bash
xattr -dr com.apple.quarantine /Applications/Skillful.app
```

Or, after the failed launch, open **System Settings → Privacy & Security**, scroll to
the bottom, and click **Open Anyway**. You only need to do this once per install.

## Linux

Skillful publishes multiple Linux artifacts because Linux users reasonably expect different install paths.

### Debian / Ubuntu

Use the `.deb` package.

```bash
sudo apt install ./skillful_*_amd64.deb
```

### Fedora / RPM-based distributions

Use the `.rpm` package.

```bash
sudo dnf install ./skillful-*.x86_64.rpm
```

### Arch / CachyOS / pacman-based distributions

Use the AUR package when you want package-manager updates:

```bash
yay -S skillful-bin
```

Or install the pacman package from GitHub Releases manually:

```bash
sudo pacman -U ./skillful-*.pacman
```

### Snap

Skillful is intended to be available through the official Snap Store.

```bash
sudo snap install skillful
```

GitHub Releases also attach a `.snap` artifact for manual local installs and testing.

```bash
sudo snap install --dangerous ./skillful_*.snap
```

The `--dangerous` flag is only required for locally installed Snap files that do not come directly from the Snap Store.

### Flatpak

Skillful attaches a Flatpak bundle to GitHub Releases.

```bash
flatpak install --user ./Skillful*.flatpak
flatpak run tech.mastermindzh.skillful
```

### AppImage

Use this when you want the fastest local test without installing a package.

```bash
chmod +x Skillful-*.AppImage
./Skillful-*.AppImage
```

## Updates

Update behavior depends on how Skillful was installed.

- Windows, macOS, and AppImage builds can use the in-app updater path when release verification is enabled for that platform.
- Package-managed Linux formats should be updated through the same package method you used to install them.
- Official Snap Store installs update through Snap.

## Data Location

Skillful keeps your library as folders on disk.

Default layout:

```text
~/.config/skillful/skills/
~/.config/skillful/agents/
```

Electron runtime data is stored separately from the library root so the app does not mix browser cache files with your skills and agents.
