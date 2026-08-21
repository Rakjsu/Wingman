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
git clone https://github.com/Rakjsu/Wingman.git
cd Wingman
npm install
npm run tauri dev
```

The first `tauri dev` compiles the Rust bundle (~2–5 min). Subsequent runs are near-instant.

## Project layout

```
src/                    React frontend
  components/           Sidebar, PackageList, dialogs, feedback
  hooks/                events, operation queue, storage, theme, toasts
  lib/                  api bridge, error mapping, shared types
  data/featured.ts      Curated catalogue shown on an empty Discover
  i18n.ts               en / pt / es, plurals, dates, collation
  App.tsx               Sections and orchestration
src-tauri/              Rust backend
  src/lib.rs            Tauri builder, plugins, handler registration
  src/commands.rs       #[tauri::command] surface (frontend ↔ backend)
  src/winget.rs         Process control, parser, cancellation registry
  src/error.rs          winget exit codes → typed errors
  src/logging.rs        Rotated file logs
  tests/integration.rs  Runs against a real winget
  tauri.conf.json       App identity, window, CSP, bundle config
public/                 Static assets (logo, favicon)
```

[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) explains why the pieces are shaped
this way, including the parsing traps winget sets.

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
- **Comments** — write code that explains itself. Add a comment only when the _why_ is non-obvious (subtle invariant, workaround for a bug, hidden constraint).
- **Identifiers** — use full English words; avoid one-letter names except for trivial loop counters.
- **CSS** — extend the tokens at the top of [src/App.css](src/App.css) (`--accent`, `--surface`, …) instead of hardcoding colours, and keep both themes working.
- **Accessibility** — every control needs an accessible name; `src/a11y.test.tsx` runs `axe` over the main screens and will fail the build.

## Commit messages

[Conventional Commits](https://www.conventionalcommits.org/) are encouraged but not enforced. Examples:

- `feat: add UAC auto-elevation modal`
- `fix(parser): handle tables without a Source column`
- `chore: bump tauri to 2.1.2`
- `docs: clarify build prerequisites`

## Pull request checklist

- [ ] Branch off `main` and rebase before opening the PR
- [ ] Tests added or updated, where it makes sense
- [ ] Every check in "Running checks" passes locally
- [ ] CHANGELOG.md updated under `[Unreleased]` if the change is user-visible
- [ ] PR description references the related issue (if any) and explains _why_

## Adding a translation

Everything lives in [src/i18n.ts](src/i18n.ts):

1. Add your code to the `Lang` union at the top of the file
2. Copy the `en` object, translate the values, and add it to `dictionaries`
3. Add an entry to `LANGUAGES` so it appears in the sidebar picker
4. Teach `detectLang()` to return your code for the matching `navigator.language`

`npm run test` then checks the new dictionary for you: it must have exactly the
same keys as English, the same `{placeholders}` in each string, and a `singular|plural`
form wherever English has one. Plural selection uses `Intl.PluralRules`, so each
language applies its own rules.

No other file needs changing.

## Reporting bugs / requesting features

Please use the issue templates in `.github/ISSUE_TEMPLATE/`. They prompt you for everything needed to reproduce and triage quickly.

## Security

Don't open public issues for vulnerabilities. See [SECURITY.md](SECURITY.md).
