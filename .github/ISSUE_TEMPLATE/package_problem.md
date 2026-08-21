---
name: A package will not install, update or uninstall
about: One specific package misbehaves through Wingman
title: "[package] <package identifier>"
labels: package
assignees: ''
---

## Package

- **Identifier** (right-click the row → Copy identifier):
- **Operation**: install / update / uninstall
- **Source**: winget / msstore

## What happened

The message Wingman showed, and what you expected instead.

## Does the same thing happen in the terminal?

This tells us whether the problem is Wingman or winget itself. Run the matching
command and paste the output:

```powershell
winget install --id <identifier> --exact
# or
winget upgrade --id <identifier> --exact
# or
winget uninstall --id <identifier> --exact
```

- [ ] It fails the same way in the terminal (likely a winget or package issue)
- [ ] It works in the terminal but not in Wingman (a Wingman bug — thank you!)

## Environment

- **Wingman version** (shown under the logo in the sidebar):
- **Windows version** (`winver`):
- **winget version** (`winget --version`):
- **Running as administrator?** yes / no

## Log

Open the activity log in Wingman (sidebar → Show log → Copy), or attach the
relevant part of `%LOCALAPPDATA%\Wingman\logs`.

<details>
<summary>Log output</summary>

```
paste here
```

</details>
