//! Integration tests that talk to the real `winget` on this machine.
//!
//! They are `#[ignore]`d so a CI runner without App Installer stays green.
//! Run them locally with:
//!
//! ```powershell
//! cd src-tauri
//! cargo test --test integration -- --ignored --test-threads=1
//! ```
//!
//! `--test-threads=1` is required, not cosmetic: winget takes a lock on its
//! package source, so concurrent invocations make each other fail. The app
//! itself absorbs this through the retry/backoff in `winget::run_capture_retrying`,
//! but these tests shell out directly and have no such cushion.

use std::process::Command;

fn winget_output(args: &[&str]) -> Option<String> {
    let output = Command::new("winget").args(args).output().ok()?;
    if !output.status.success() {
        return None;
    }
    let bytes = output.stdout;
    if bytes.starts_with(&[0xFF, 0xFE]) {
        let (cow, _, _) = encoding_rs::UTF_16LE.decode(&bytes[2..]);
        Some(cow.into_owned())
    } else {
        Some(String::from_utf8_lossy(&bytes).into_owned())
    }
}

#[test]
#[ignore = "requires winget on PATH"]
fn winget_is_available() {
    let version = winget_output(&["--version"]).expect("winget --version should succeed");
    assert!(
        version.trim().starts_with('v')
            || version.chars().next().is_some_and(|c| c.is_ascii_digit()),
        "unexpected version string: {version}"
    );
}

#[test]
#[ignore = "requires winget on PATH and network access"]
fn search_finds_vscode() {
    let out = winget_output(&[
        "search",
        "vscode",
        "--accept-source-agreements",
        "--disable-interactivity",
    ])
    .expect("winget search should succeed");

    let packages = wingman_lib::parse_packages_for_tests(&out);
    assert!(
        packages
            .iter()
            .any(|p| p.id == "Microsoft.VisualStudioCode"),
        "expected Microsoft.VisualStudioCode among {} results",
        packages.len()
    );
}

#[test]
#[ignore = "requires winget on PATH"]
fn list_installed_is_not_empty() {
    let out = winget_output(&[
        "list",
        "--disable-interactivity",
        "--accept-source-agreements",
    ])
    .expect("winget list should succeed");
    let packages = wingman_lib::parse_packages_for_tests(&out);
    assert!(
        !packages.is_empty(),
        "a development machine should have at least one package"
    );
}

#[test]
#[ignore = "requires winget on PATH"]
fn every_parsed_row_has_an_id() {
    let out = winget_output(&[
        "list",
        "--disable-interactivity",
        "--accept-source-agreements",
    ])
    .expect("winget list should succeed");
    for package in wingman_lib::parse_packages_for_tests(&out) {
        assert!(!package.id.trim().is_empty(), "parsed a row without an id");
        assert!(
            !package.id.contains("  "),
            "id looks like it absorbed a neighbouring column: {:?}",
            package.id
        );
    }
}
