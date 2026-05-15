# Changelog

All notable changes to **Wingman** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned
- UAC auto-elevation when an operation requires admin
- Cancel in-flight install / uninstall / upgrade
- Detect missing winget at startup with a friendly onboarding screen
- Retry with backoff and timeouts on list operations
- Persistent logs in `%LOCALAPPDATA%\Wingman\logs`
- JSON-based parser for `winget` (with tabular fallback)
- Package details modal (description, homepage, versions, dependencies)
- Favorites stored in localStorage
- Export / import package lists (`winget export` / `winget import`)
- Source filter (winget / msstore)
- GitHub Actions CI + signed MSI release pipeline
- Auto-updater via `tauri-plugin-updater`
- Publish manifest to [winget-pkgs](https://github.com/microsoft/winget-pkgs) as `Rakjs.Wingman`

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
