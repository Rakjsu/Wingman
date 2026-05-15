use serde::Serialize;
use std::process::Stdio;
use thiserror::Error;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

#[derive(Debug, Error, Serialize)]
pub enum WingetError {
    #[error("winget command failed: {0}")]
    CommandFailed(String),
    #[error("io error: {0}")]
    Io(String),
    #[error("parse error: {0}")]
    Parse(String),
}

impl From<std::io::Error> for WingetError {
    fn from(e: std::io::Error) -> Self {
        WingetError::Io(e.to_string())
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct Package {
    pub name: String,
    pub id: String,
    pub version: String,
    pub available: Option<String>,
    pub source: Option<String>,
}

fn decode(bytes: &[u8]) -> String {
    // winget often emits UTF-16 LE on Windows. Detect BOM, fallback to UTF-8.
    if bytes.starts_with(&[0xFF, 0xFE]) {
        let (cow, _, _) = encoding_rs::UTF_16LE.decode(&bytes[2..]);
        cow.into_owned()
    } else if bytes.starts_with(&[0xFE, 0xFF]) {
        let (cow, _, _) = encoding_rs::UTF_16BE.decode(&bytes[2..]);
        cow.into_owned()
    } else {
        String::from_utf8_lossy(bytes).into_owned()
    }
}

/// Parse a winget table. Returns rows as (header_name, value) pairs.
///
/// Strategy: locate the header line (starts with "Name" and contains "Id"),
/// derive column start positions from the header (each known column name is
/// found left-to-right), and slice subsequent rows by those positions. The
/// dashed separator line below the header is skipped — its dashes are
/// continuous and don't reliably mark column boundaries.
pub fn parse_table(output: &str) -> Vec<Vec<(String, String)>> {
    const KNOWN_COLS: &[&str] = &["Name", "Id", "Version", "Match", "Available", "Source"];

    // winget mixes carriage-returned spinner/progress output onto the same
    // logical line as the header. Split on both \r and \n so we can find a
    // clean header line.
    let lines: Vec<&str> = output.split(|c: char| c == '\n' || c == '\r').collect();
    let header_idx = match lines.iter().position(|l| {
        let t = l.trim_start();
        t.starts_with("Name") && l.contains("Id")
    }) {
        Some(i) => i,
        None => return Vec::new(),
    };
    let header = lines[header_idx];

    // Find each known column's start (char index) within header, in order.
    let header_chars: Vec<char> = header.chars().collect();
    let mut cols: Vec<(String, usize)> = Vec::new();
    let mut cursor = 0usize;
    for &name in KNOWN_COLS {
        let header_str: String = header_chars[cursor..].iter().collect();
        if let Some(rel) = header_str.find(name) {
            // ensure word boundary on the right
            let abs = cursor + header_str[..rel].chars().count();
            let after = abs + name.chars().count();
            let next_char = header_chars.get(after).copied().unwrap_or(' ');
            if next_char == ' ' || after == header_chars.len() {
                cols.push((name.to_string(), abs));
                cursor = after;
            }
        }
    }
    if cols.len() < 2 {
        return Vec::new();
    }

    let slice_chars = |line: &str, start: usize, end: Option<usize>| -> String {
        let chars: Vec<char> = line.chars().collect();
        let s = start.min(chars.len());
        let e = end.unwrap_or(chars.len()).min(chars.len()).max(s);
        chars[s..e].iter().collect::<String>().trim().to_string()
    };

    let starts: Vec<usize> = cols.iter().map(|(_, s)| *s).collect();
    let names: Vec<String> = cols.iter().map(|(n, _)| n.clone()).collect();

    let mut rows = Vec::new();
    let start_data = header_idx + 1;
    for line in lines.iter().skip(start_data) {
        if line.trim().is_empty() {
            continue;
        }
        // Skip the dashed separator and progress/spinner artifacts.
        let trimmed = line.trim_start();
        if trimmed.starts_with('-') && trimmed.chars().all(|c| c == '-' || c == ' ') {
            continue;
        }
        if line.contains('\u{2588}') || line.contains('\u{2592}') || line.starts_with('\r') {
            continue;
        }
        let mut row: Vec<(String, String)> = Vec::with_capacity(names.len());
        for i in 0..starts.len() {
            let end = if i + 1 < starts.len() {
                Some(starts[i + 1])
            } else {
                None
            };
            row.push((names[i].clone(), slice_chars(line, starts[i], end)));
        }
        rows.push(row);
    }
    rows
}

fn rows_to_packages(rows: Vec<Vec<(String, String)>>) -> Vec<Package> {
    rows.into_iter()
        .filter_map(|row| {
            let mut name = String::new();
            let mut id = String::new();
            let mut version = String::new();
            let mut available = None;
            let mut source = None;
            for (k, v) in row {
                match k.as_str() {
                    "Name" => name = v,
                    "Id" => id = v,
                    "Version" => version = v,
                    "Available" => {
                        if !v.is_empty() {
                            available = Some(v);
                        }
                    }
                    "Source" => {
                        if !v.is_empty() {
                            source = Some(v);
                        }
                    }
                    _ => {}
                }
            }
            if id.is_empty() {
                None
            } else {
                Some(Package {
                    name,
                    id,
                    version,
                    available,
                    source,
                })
            }
        })
        .collect()
}

async fn run_winget(args: &[&str]) -> Result<String, WingetError> {
    let output = Command::new("winget")
        .args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .await?;
    if !output.status.success() {
        let err = decode(&output.stderr);
        return Err(WingetError::CommandFailed(err));
    }
    Ok(decode(&output.stdout))
}

pub async fn search(query: &str) -> Result<Vec<Package>, WingetError> {
    if query.trim().is_empty() {
        return Ok(Vec::new());
    }
    let out = run_winget(&[
        "search",
        query,
        "--accept-source-agreements",
        "--disable-interactivity",
    ])
    .await?;
    Ok(rows_to_packages(parse_table(&out)))
}

pub async fn list_installed() -> Result<Vec<Package>, WingetError> {
    let out = run_winget(&["list", "--disable-interactivity"]).await?;
    Ok(rows_to_packages(parse_table(&out)))
}

pub async fn list_upgradable() -> Result<Vec<Package>, WingetError> {
    let out = run_winget(&[
        "upgrade",
        "--include-unknown",
        "--disable-interactivity",
    ])
    .await?;
    Ok(rows_to_packages(parse_table(&out))
        .into_iter()
        .filter(|p| p.available.is_some())
        .collect())
}

/// Run an action (install/uninstall/upgrade) streaming stdout lines via callback.
pub async fn run_action<F>(action: &str, id: &str, mut on_line: F) -> Result<(), WingetError>
where
    F: FnMut(String) + Send,
{
    let mut child = Command::new("winget")
        .args([
            action,
            "--id",
            id,
            "--exact",
            "--silent",
            "--accept-package-agreements",
            "--accept-source-agreements",
            "--disable-interactivity",
        ])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()?;
    let stdout = child.stdout.take().ok_or_else(|| {
        WingetError::Io("failed to capture stdout".into())
    })?;
    let mut reader = BufReader::new(stdout).lines();
    while let Some(line) = reader.next_line().await? {
        on_line(line);
    }
    let status = child.wait().await?;
    if !status.success() {
        return Err(WingetError::CommandFailed(format!(
            "winget {action} exited with code {:?}",
            status.code()
        )));
    }
    Ok(())
}

pub async fn upgrade_all<F>(mut on_line: F) -> Result<(), WingetError>
where
    F: FnMut(String) + Send,
{
    let mut child = Command::new("winget")
        .args([
            "upgrade",
            "--all",
            "--silent",
            "--accept-package-agreements",
            "--accept-source-agreements",
            "--disable-interactivity",
            "--include-unknown",
        ])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()?;
    let stdout = child.stdout.take().ok_or_else(|| {
        WingetError::Io("failed to capture stdout".into())
    })?;
    let mut reader = BufReader::new(stdout).lines();
    while let Some(line) = reader.next_line().await? {
        on_line(line);
    }
    let status = child.wait().await?;
    if !status.success() {
        return Err(WingetError::CommandFailed(format!(
            "winget upgrade --all exited with code {:?}",
            status.code()
        )));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE: &str = "Name               Id                          Version      Source
-----------------------------------------------------------------------
Visual Studio Code Microsoft.VisualStudioCode  1.85.0       winget
7-Zip              7zip.7zip                   23.01        winget
";

    #[test]
    fn parses_simple_table() {
        let rows = parse_table(SAMPLE);
        let pkgs = rows_to_packages(rows);
        assert_eq!(pkgs.len(), 2);
        assert_eq!(pkgs[0].id, "Microsoft.VisualStudioCode");
        assert_eq!(pkgs[0].name, "Visual Studio Code");
        assert_eq!(pkgs[0].version, "1.85.0");
        assert_eq!(pkgs[0].source.as_deref(), Some("winget"));
        assert_eq!(pkgs[1].id, "7zip.7zip");
    }

    const UPGRADE_SAMPLE: &str = "Name      Id           Version   Available  Source
----------------------------------------------------------
7-Zip     7zip.7zip    23.01     24.05      winget
";

    #[test]
    fn parses_upgrade_table_with_available() {
        let rows = parse_table(UPGRADE_SAMPLE);
        let pkgs = rows_to_packages(rows);
        assert_eq!(pkgs.len(), 1);
        assert_eq!(pkgs[0].available.as_deref(), Some("24.05"));
    }
}
