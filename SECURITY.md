# Security Policy

## Supported versions

Only the latest released version of Wingman receives security fixes. Older versions are not patched.

| Version | Supported |
| ------- | :-------: |
| latest  | ✅        |
| older   | ❌        |

## Reporting a vulnerability

**Please do not open a public GitHub issue for security problems.**

Instead, report privately via either:

- GitHub's [private Security Advisory](https://github.com/rakjs/Wingman/security/advisories/new) form (preferred), or
- Email to **rakjs@github.com** with the subject line `[security] Wingman <short title>`

Please include:

- A clear description of the issue and its impact
- Steps to reproduce, or a proof-of-concept if you have one
- The Wingman version and Windows version where you observed it
- Whether you'd like to be credited in the fix announcement

## Response timeline

This is a personal/community project — responses are best-effort, but the goal is:

- Acknowledge the report within **72 hours**
- Provide a triage assessment within **7 days**
- Ship a fix in the next reasonable release

## Scope

In scope:

- The Wingman desktop application (Rust backend, React frontend)
- Build artifacts published to the Releases page

Out of scope:

- Vulnerabilities in upstream dependencies (Tauri, React, winget itself) — please report those to their maintainers
- Issues that require physical access to an already-compromised machine
- Social engineering of users or maintainers

## What Wingman stores, and what it sends

Wingman has no telemetry, no accounts, and makes no network requests of its own.
The only traffic is whatever `winget` itself performs to reach its package
sources.

Kept locally, and never transmitted:

| Data                                                    | Location                          | Retention |
| ------------------------------------------------------- | --------------------------------- | --------- |
| Operation logs, including the identifiers of packages you install or remove | `%LOCALAPPDATA%\Wingman\logs` | 14 days, rotated daily |
| Theme, language, favorites, pins, operation history      | Local storage inside the app      | Until cleared |
| Window size and position                                 | Tauri window-state plugin         | Until cleared |

The logs name the software on your machine, so treat them as personal data:
review before attaching one to a public issue.

Thanks for helping keep Wingman and its users safe.
