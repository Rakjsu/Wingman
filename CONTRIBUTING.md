# Contributing to Wingman

Thanks for your interest in helping out! This document explains how to get a working dev environment, how to organize a change, and what we look for in pull requests.

## Code of Conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). By participating you agree to uphold it.

## Development setup

**Required tooling**

- [Rust](https://rustup.rs/) with the MSVC toolchain (`rustup default stable-msvc`)
- [Node.js](https://nodejs.org/) 20 LTS or newer
- [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) (Desktop development with C++)
- [WebView2 runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) (preinstalled on Windows 11)
- `winget` in `PATH` — verify with `winget --version`

**First-time setup**

```powershell
git clone https://github.com/rakjs/Wingman.git
cd Wingman
npm install
npm run tauri dev
```

The first `tauri dev` compiles the Rust bundle (~2–5 min). Subsequent runs are near-instant.

## Project layout

```
src/                React frontend
  components/       Reusable UI pieces
  hooks/useWinget   invoke() wrapper + event listener
  data/featured.ts  Curated package list shown on empty Discover
  i18n.ts           Bundled PT/EN strings + t() helper
src-tauri/          Rust backend
  src/lib.rs        Tauri builder + handler registration
  src/commands.rs   #[tauri::command] surface (frontend ↔ backend)
  src/winget.rs     winget process wrapper + tabular parser
  tauri.conf.json   App identity, window, bundle config
public/             Static assets (logo, favicon)
```

## Running checks

Before opening a PR, please run:

```powershell
# Frontend: types, lint, formatting, tests, build
npx tsc --noEmit
npm run lint
npm run format:check
npm run test
npm run build

# Backend: formatting, lint, tests
cd src-tauri
cargo fmt --all --check
cargo clippy --all-targets -- -D warnings
cargo test --lib
```

CI runs exactly these. There is also a set of integration tests that drive the
real winget on your machine:

```powershell
cd src-tauri
cargo test --test integration -- --ignored --test-threads=1
```

`--test-threads=1` is required: winget locks its package source, so parallel
invocations make each other fail.

## Coding conventions

- **Rust** — `cargo fmt` defaults. Prefer `?` over `.unwrap()`. Errors should bubble up as `WingetError`.
- **TypeScript / React** — function components, `useCallback`/`useMemo` only when needed, prefer named exports.
- **Comments** — write code that explains itself. Add a comment only when the *why* is non-obvious (subtle invariant, workaround for a bug, hidden constraint).
- **Identifiers** — use full English words; avoid one-letter names except for trivial loop counters.
- **CSS** — extend the variables in [src/App.css](src/App.css) (`--accent`, `--panel`, …) instead of hardcoding colors.

## Commit messages

[Conventional Commits](https://www.conventionalcommits.org/) are encouraged but not enforced. Examples:

- `feat: add UAC auto-elevation modal`
- `fix(parser): handle tables without a Source column`
- `chore: bump tauri to 2.1.2`
- `docs: clarify build prerequisites`

## Pull request checklist

- [ ] Branch off `main` and rebase before opening the PR
- [ ] Tests added or updated, where it makes sense
- [ ] `cargo test`, `tsc --noEmit`, and `npm run build` all pass locally
- [ ] CHANGELOG.md updated under `[Unreleased]` if the change is user-visible
- [ ] PR description references the related issue (if any) and explains *why*

## Adding a translation

Edit [src/i18n.ts](src/i18n.ts):

1. Add a new top-level key to the `translations` object (e.g. `es: {...}`)
2. Update the `Lang` type union and `detectLang()` to return your code when `navigator.language` matches
3. Open a PR — no other files need changing

## Reporting bugs / requesting features

Please use the issue templates in `.github/ISSUE_TEMPLATE/`. They prompt you for everything needed to reproduce and triage quickly.

## Security

Don't open public issues for vulnerabilities. See [SECURITY.md](SECURITY.md).
