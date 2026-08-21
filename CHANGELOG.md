# Changelog

All notable changes to **Wingman** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Light / dark / system theme** with a switcher in the sidebar; "system" follows the OS live
- **Sidebar navigation** replacing the tab bar, with live badges for installed and upgradable counts
- **History** section listing every operation with its outcome and timestamp
- **Favorites** — star any package to pin it to the top of Discover
- **Pins** — mark a package to be skipped by "Update all"
- **Batch uninstall** — select several installed packages and remove them in sequence
- **Package details** dialog: publisher, licence, description, homepage, and installable version list
- **Install a specific version** from the details dialog
- **Export / import** package lists via `winget export` / `winget import`
- **Cancel** a running install, uninstall or upgrade; the whole process tree is killed
- **Real progress bars** parsed from winget's own percentage output
- **Confirmation dialogs** before uninstalling, batch-uninstalling, updating everything, or importing a list
- **Toasts** for completed operations, with an activity log panel that can be copied or opened on disk
- **Onboarding screen** when winget is missing or older than 1.6, linking to the Microsoft Store
- **Administrator relaunch** offered automatically when winget reports it needs elevation
- **Local filtering and sorting** of the installed list (by name, identifier or source)
- **Source filter** for search (winget / msstore)
- **Background update check** every six hours with a native notification
- **Persistent logs** in `%LOCALAPPDATA%\Wingman\logs`, rotated daily
- **Window position and size** are remembered between sessions
- `Ctrl+4` opens History alongside the existing shortcuts
- Frontend test suite (Vitest + Testing Library) and Rust integration tests against a live winget
- GitHub Actions CI: type-check, lint, format check, unit tests, clippy, `cargo fmt`, npm/cargo audit, and a tagged release job that bundles the MSI and NSIS installers
- ESLint, Prettier, and Dependabot configuration

### Changed
- Renamed Cargo package from `tauri-app` to `wingman` and added an explicit `[[bin]]` section so the produced binary is `Wingman.exe` (was `tauri-app.exe`)
- Renamed the Rust library crate from `tauri_app_lib` to `wingman_lib`
- Errors are now a typed enum mapped from winget's exit codes, so the UI can offer the right recovery instead of printing raw text
- Read-only winget calls retry with backoff when the package source is locked, and time out after 60 seconds
- Search results are cached for five minutes and invalidated after any mutating operation
- Installed and upgradable lists now load in parallel at startup
- Lists over 40 rows are virtualised
- Release profile builds with LTO, one codegen unit, symbol stripping and `panic = "abort"`
- Package identifiers coming from the frontend are validated before reaching the process layer

### Fixed
- **Duplicate log lines**: every winget event was handled twice because a subscription that resolved after React's StrictMode teardown was never unsubscribed. Covered by a regression test
- **Truncated names in non-Latin scripts**: the table parser sliced by character index while winget pads by display width, dropping one character per wide (CJK) glyph
- **stderr was discarded**: winget's error output is now streamed and surfaced alongside stdout
- **Orphaned installers**: closing the window now kills the winget process tree instead of leaving installs running invisibly
- Content Security Policy was disabled (`csp: null`) and is now an explicit allow-list
- The capability file granted the whole `opener` plugin; it now lists only the specific permissions used

### Security
- Fixed all 5 npm advisories reported by `npm audit` (2 low, 3 high) in build tooling

### Planned
- **Drive winget through its COM API** (`Microsoft.Management.Deployment`) instead of parsing
  console output. Verified feasible on 2026-08-21: the winmd ships with App Installer and the
  out-of-process COM server activates from an unpackaged process. The `Backend` enum in
  `winget.rs` is the seam it will plug into. Note that `winget search --output json` does **not**
  exist (checked against winget v1.29.290), so COM is the only route to structured results.
- Code-signed MSI (unsigned builds trip SmartScreen)
- Auto-updater via `tauri-plugin-updater`
- Publish manifest to [winget-pkgs](https://github.com/microsoft/winget-pkgs) as `Rakjs.Wingman`
- Opt-in anonymous usage telemetry
- Landing page on GitHub Pages

## [0.1.0] - 2026-05-14

Initial public MVP.

### Added
- Tauri 2 + React 19 + TypeScript scaffold with tokio-based winget wrapper
- Three-tab UI: **Discover** / **Installed** / **Updates**
- Search packages with 400 ms debounce
- Install, uninstall, upgrade individual packages
- Upgrade all available packages in one click
- Streaming progress events (`winget-progress` / `winget-done`) shown in a live log panel
- UTF-16 BOM-aware tabular parser for `winget` output, tolerant of progress/spinner noise
- Featured grid of curated popular packages on the empty Discover state
- Minimal in-house i18n (PT-BR / EN) auto-detected from `navigator.language`
- Keyboard shortcuts: `Ctrl+F` focus search, `Ctrl+1/2/3` switch tabs, `Esc` dismiss error
- Custom Wingman icon (W glyph in blue gradient) generated for Windows / macOS / Linux / iOS / Android targets
- Dark theme with accessible contrast
- Unit tests for the table parser

[Unreleased]: https://github.com/rakjs/Wingman/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/rakjs/Wingman/releases/tag/v0.1.0
