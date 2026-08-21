<div align="center">
  <img src="public/wingman.svg" width="96" height="96" alt="Wingman logo" />
  <h1>Wingman</h1>
  <p><strong>A friendly GUI for <a href="https://learn.microsoft.com/en-us/windows/package-manager/winget/">winget</a>.</strong></p>

  <p>
    <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT license" /></a>
    <img src="https://img.shields.io/badge/platform-Windows-0078D6?logo=windows" alt="Windows" />
    <img src="https://img.shields.io/badge/built%20with-Tauri%202-24C8DB?logo=tauri" alt="Tauri 2" />
    <img src="https://img.shields.io/badge/version-0.1.0-orange" alt="Version 0.1.0" />
  </p>
</div>

---

Wingman is a lightweight desktop app that turns Windows' command-line package manager (`winget`) into a clean, fast UI. Search, install, uninstall, and update apps without touching a terminal.

## Features

- **Discover** — search the winget catalogue, or browse curated picks grouped by category
- **Installed** — filter, sort, uninstall one package or a whole selection at once
- **Updates** — update packages individually or all together, with pins to skip the ones you handle yourself
- **History** — every operation with its outcome and timestamp
- **Details** — publisher, licence, description, homepage and per-version install
- **Favorites** — star packages to keep them at the top of Discover
- **Import / export** — carry your package list to a new machine
- **Cancel anything** — stop a running install; the whole process tree goes with it
- **Real progress** — live percentage parsed from winget, plus a copyable activity log
- **Light, dark or system** theme
- **Bilingual** — UI auto-detects PT-BR or EN from your system
- **Keyboard-first** — `Ctrl+F` to search, `Ctrl+1..4` for sections, `Esc` to dismiss
- **Handles elevation** — offers to relaunch as administrator when winget demands it
- **Tiny binary** — native WebView2, no Electron bloat

## Install

> Pre-built installers will appear on the [Releases page](https://github.com/rakjs/Wingman/releases) once v0.1.0 is published.

Once published to the official catalog:

```powershell
winget install Rakjs.Wingman
```

## Build from source

**Prerequisites**

- [Rust](https://rustup.rs/) (with the MSVC toolchain)
- [Node.js](https://nodejs.org/) 20 LTS or newer
- [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) (Desktop development with C++ workload)
- [WebView2 runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) (preinstalled on Windows 11)
- `winget` available in `PATH` — verify with `winget --version`

**Run in development**

```powershell
git clone https://github.com/rakjs/Wingman.git
cd Wingman
npm install
npm run tauri dev
```

`tauri dev` starts the Vite dev server on port 1420 and opens the Wingman window. **Don't double-click the binary in `src-tauri/target/debug/` directly** — debug builds load the frontend from the dev server, so without `tauri dev` running you'll get a blank window (or worse, the UI of any other Vite project squatting on port 1420).

**Bundle a standalone release**

```powershell
npm run tauri build
```

Produces a single self-contained `Wingman.exe` plus an installer (`.msi`) in `src-tauri/target/release/bundle/msi/`. These are what you ship to users — they don't need Node, Rust, or a dev server.

## Tech stack

- [Tauri 2](https://tauri.app/) — Rust shell + native WebView2
- [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) — frontend
- [Vite](https://vitejs.dev/) — dev server / bundler
- [tokio](https://tokio.rs/) — async process orchestration
- Custom column-aware parser for `winget` tabular output (UTF-16 BOM aware)

## Project layout

```
Wingman/
├── src/                    # React frontend
│   ├── components/         # TabNav, PackageList, FeaturedGrid, …
│   ├── hooks/              # useWinget — invoke + event listeners
│   ├── data/featured.ts    # Curated popular packages
│   └── i18n.ts             # Bundled PT/EN strings
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── lib.rs          # Tauri builder + handlers
│   │   ├── commands.rs     # #[tauri::command] surface
│   │   └── winget.rs       # winget process wrapper + parser
│   └── tauri.conf.json     # App identity, window, bundle config
└── public/                 # Static assets (logo, favicon)
```

## Roadmap

See [the project roadmap](CHANGELOG.md#unreleased) for what's coming next. High-level direction:

- **Robustness** — UAC auto-elevation, cancel in-flight operations, persistent logs
- **Store features** — package details, favorites, export/import lists, source filters
- **Distribution** — GitHub Actions CI, signed MSI, auto-updater, `winget-pkgs` manifest

## Contributing

Contributions are very welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, conventions, and PR guidelines. By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).

Found a security issue? Please follow the process in [SECURITY.md](SECURITY.md) — don't open a public issue.

## License

[MIT](LICENSE) © 2026 Rakjsu

`winget` is a trademark of Microsoft Corporation. Wingman is an independent third-party UI and is not affiliated with or endorsed by Microsoft.
