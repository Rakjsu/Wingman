use crate::error::WingetError;
use serde::Serialize;
use std::collections::HashMap;
use std::process::Stdio;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use tokio::sync::mpsc;
use unicode_width::UnicodeWidthChar;

pub const MIN_SUPPORTED_VERSION: (u32, u32) = (1, 6);
const LIST_TIMEOUT_SECS: u64 = 60;
const MAX_QUERY_LEN: usize = 200;
const SEARCH_CACHE_CAPACITY: usize = 20;
const SEARCH_CACHE_TTL: Duration = Duration::from_secs(300);

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct Package {
    pub name: String,
    pub id: String,
    pub version: String,
    pub available: Option<String>,
    pub source: Option<String>,
    /// Populated by `search` when winget reports why a package matched
    /// (moniker, tag, …). Useful to explain surprising results to the user.
    pub matched_on: Option<String>,
}

#[derive(Debug, Clone, Serialize, Default)]
pub struct PackageDetails {
    pub id: String,
    pub name: String,
    pub publisher: Option<String>,
    pub version: Option<String>,
    pub description: Option<String>,
    pub homepage: Option<String>,
    pub license: Option<String>,
    pub versions: Vec<String>,
}

/// One line of streamed output plus, when winget reported one, a percentage.
#[derive(Debug, Clone, Serialize)]
pub struct ProgressLine {
    pub line: String,
    pub percent: Option<u8>,
    pub is_stderr: bool,
}

// ---------------------------------------------------------------------------
// Encoding
// ---------------------------------------------------------------------------

/// winget emits UTF-16 with a BOM in some shells and plain UTF-8 in others.
pub fn decode(bytes: &[u8]) -> String {
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

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

/// Package ids reach us from the frontend. They are passed as separate argv
/// entries (never through a shell), but a leading dash would still be read by
/// winget as a flag, so reject those outright.
pub fn validate_id(id: &str) -> Result<(), WingetError> {
    if id.is_empty() || id.len() > 256 {
        return Err(WingetError::InvalidId(
            "identifier must be 1-256 characters".into(),
        ));
    }
    if id.starts_with('-') {
        return Err(WingetError::InvalidId(
            "identifier must not start with '-'".into(),
        ));
    }
    if id.chars().any(|c| c.is_control()) {
        return Err(WingetError::InvalidId(
            "identifier must not contain control characters".into(),
        ));
    }
    Ok(())
}

fn validate_query(query: &str) -> Result<(), WingetError> {
    if query.len() > MAX_QUERY_LEN {
        return Err(WingetError::InvalidId(format!(
            "query must be at most {MAX_QUERY_LEN} characters"
        )));
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Output parsing
// ---------------------------------------------------------------------------

/// Extract a percentage from a winget progress line, e.g. `"███▒▒▒  42%"`.
pub fn parse_progress(line: &str) -> Option<u8> {
    let trimmed = line.trim_end();
    let idx = trimmed.rfind('%')?;
    let digits: String = trimmed[..idx]
        .chars()
        .rev()
        .take_while(|c| c.is_ascii_digit())
        .collect::<Vec<_>>()
        .into_iter()
        .rev()
        .collect();
    if digits.is_empty() {
        return None;
    }
    digits.parse::<u16>().ok().map(|v| v.min(100) as u8)
}

/// True for lines that are pure spinner / progress-bar noise.
pub fn is_noise(line: &str) -> bool {
    let t = line.trim();
    if t.is_empty() {
        return true;
    }
    // Block-drawing characters used by the progress bar.
    if t.contains('\u{2588}') || t.contains('\u{2592}') || t.contains('\u{2593}') {
        return true;
    }
    // Spinner frames: only -, \, |, / and spaces.
    if t.chars().all(|c| matches!(c, '-' | '\\' | '|' | '/' | ' ')) {
        return true;
    }
    false
}

/// Total terminal columns a string occupies.
fn display_width(s: &str) -> usize {
    s.chars()
        .map(|c| UnicodeWidthChar::width(c).unwrap_or(0))
        .sum()
}

/// Take the characters that render between display columns `[start, end)`.
///
/// winget pads its table by *display width*, so a CJK name (2 columns per
/// character) shifts every later column relative to a plain character count.
/// Slicing by char index silently eats a character per wide glyph.
fn slice_cols(line: &str, start: usize, end: Option<usize>) -> String {
    let mut col = 0usize;
    let mut out = String::new();
    for ch in line.chars() {
        if col >= start && end.is_none_or(|e| col < e) {
            out.push(ch);
        }
        col += UnicodeWidthChar::width(ch).unwrap_or(0);
        if end.is_some_and(|e| col >= e) {
            break;
        }
    }
    out.trim().to_string()
}

/// Parse a winget table into (header, value) pairs per row.
///
/// Column boundaries come from the *header* line, not the dashed separator:
/// the separator is one continuous run of dashes, so it carries no column
/// information. Lines are split on both `\r` and `\n` because winget rewrites
/// its progress bar with carriage returns, which otherwise buries the header
/// inside one enormous logical line.
pub fn parse_table(output: &str) -> Vec<Vec<(String, String)>> {
    const KNOWN_COLS: &[&str] = &["Name", "Id", "Version", "Match", "Available", "Source"];

    let lines: Vec<&str> = output.split(['\n', '\r']).collect();
    let header_idx = match lines.iter().position(|l| {
        let t = l.trim_start();
        t.starts_with("Name") && l.contains("Id")
    }) {
        Some(i) => i,
        None => return Vec::new(),
    };
    let header = lines[header_idx];

    let header_chars: Vec<char> = header.chars().collect();
    let mut cols: Vec<(String, usize)> = Vec::new();
    let mut cursor = 0usize;
    for &name in KNOWN_COLS {
        let rest: String = header_chars[cursor..].iter().collect();
        if let Some(rel) = rest.find(name) {
            let char_idx = cursor + rest[..rel].chars().count();
            let after = char_idx + name.chars().count();
            let next_char = header_chars.get(after).copied().unwrap_or(' ');
            if next_char == ' ' || after == header_chars.len() {
                let prefix: String = header_chars[..char_idx].iter().collect();
                cols.push((name.to_string(), display_width(&prefix)));
                cursor = after;
            }
        }
    }
    if cols.len() < 2 {
        return Vec::new();
    }

    let starts: Vec<usize> = cols.iter().map(|(_, s)| *s).collect();
    let names: Vec<String> = cols.iter().map(|(n, _)| n.clone()).collect();

    let mut rows = Vec::new();
    for line in lines.iter().skip(header_idx + 1) {
        if is_noise(line) {
            continue;
        }
        let trimmed = line.trim_start();
        if trimmed.starts_with('-') && trimmed.chars().all(|c| c == '-' || c == ' ') {
            continue;
        }
        let mut row: Vec<(String, String)> = Vec::with_capacity(names.len());
        for i in 0..starts.len() {
            let end = if i + 1 < starts.len() {
                Some(starts[i + 1])
            } else {
                None
            };
            row.push((names[i].clone(), slice_cols(line, starts[i], end)));
        }
        rows.push(row);
    }
    rows
}

/// Parse raw winget table output straight into packages.
/// Exposed so integration tests can exercise the parser against live output.
pub fn parse_packages(output: &str) -> Vec<Package> {
    rows_to_packages(parse_table(output))
}

fn rows_to_packages(rows: Vec<Vec<(String, String)>>) -> Vec<Package> {
    rows.into_iter()
        .filter_map(|row| {
            let mut pkg = Package {
                name: String::new(),
                id: String::new(),
                version: String::new(),
                available: None,
                source: None,
                matched_on: None,
            };
            for (k, v) in row {
                match k.as_str() {
                    "Name" => pkg.name = v,
                    "Id" => pkg.id = v,
                    "Version" => pkg.version = v,
                    "Available" if !v.is_empty() => pkg.available = Some(v),
                    "Source" if !v.is_empty() => pkg.source = Some(v),
                    "Match" if !v.is_empty() => pkg.matched_on = Some(v),
                    _ => {}
                }
            }
            if pkg.id.is_empty() || pkg.id == "Id" {
                None
            } else {
                Some(pkg)
            }
        })
        .collect()
}

/// Parse the key/value layout produced by `winget show`.
/// Unlike the table output this is not width-limited, so names arrive whole.
pub fn parse_show(output: &str, id: &str) -> PackageDetails {
    let mut details = PackageDetails {
        id: id.to_string(),
        ..Default::default()
    };
    let mut in_versions = false;

    for raw in output.split(['\n', '\r']) {
        if is_noise(raw) {
            continue;
        }
        let line = raw.trim_end();
        let trimmed = line.trim();

        if in_versions {
            if trimmed.starts_with('-') && trimmed.chars().all(|c| c == '-' || c == ' ') {
                continue;
            }
            if trimmed == "Version" {
                continue;
            }
            if !trimmed.is_empty() && !trimmed.contains(':') {
                details.versions.push(trimmed.to_string());
                continue;
            }
        }

        if trimmed.starts_with("Available Versions") || trimmed == "Version" {
            in_versions = true;
            continue;
        }

        let Some((key, value)) = trimmed.split_once(':') else {
            // The first non-empty line is `Found <Name> [<Id>]`.
            if let Some(rest) = trimmed.strip_prefix("Found ") {
                if let Some(open) = rest.rfind('[') {
                    details.name = rest[..open].trim().to_string();
                }
            }
            continue;
        };
        let value = value.trim().to_string();
        if value.is_empty() {
            continue;
        }
        match key.trim() {
            "Version" if details.version.is_none() => details.version = Some(value),
            "Publisher" => details.publisher = Some(value),
            "Description" | "Short Description" if details.description.is_none() => {
                details.description = Some(value)
            }
            "Homepage" | "Publisher Url" if details.homepage.is_none() => {
                details.homepage = Some(value)
            }
            "License" => details.license = Some(value),
            _ => {}
        }
    }
    details
}

// ---------------------------------------------------------------------------
// Search cache
// ---------------------------------------------------------------------------

struct CacheEntry {
    packages: Vec<Package>,
    stored: Instant,
}

#[derive(Default)]
pub struct SearchCache {
    entries: Mutex<Vec<(String, CacheEntry)>>,
}

impl SearchCache {
    pub fn get(&self, key: &str) -> Option<Vec<Package>> {
        let mut entries = self.entries.lock().ok()?;
        entries.retain(|(_, e)| e.stored.elapsed() < SEARCH_CACHE_TTL);
        let pos = entries.iter().position(|(k, _)| k == key)?;
        // Refresh recency: move the hit to the back.
        let hit = entries.remove(pos);
        let packages = hit.1.packages.clone();
        entries.push(hit);
        Some(packages)
    }

    pub fn put(&self, key: String, packages: Vec<Package>) {
        let Ok(mut entries) = self.entries.lock() else {
            return;
        };
        entries.retain(|(k, e)| k != &key && e.stored.elapsed() < SEARCH_CACHE_TTL);
        entries.push((
            key,
            CacheEntry {
                packages,
                stored: Instant::now(),
            },
        ));
        while entries.len() > SEARCH_CACHE_CAPACITY {
            entries.remove(0);
        }
    }

    /// Dropped after a mutating operation so the next search reflects reality
    /// instead of a stale snapshot of the catalogue.
    pub fn invalidate(&self) {
        if let Ok(mut entries) = self.entries.lock() {
            entries.clear();
        }
    }
}

// ---------------------------------------------------------------------------
// Running operation registry (cancellation + orphan cleanup)
// ---------------------------------------------------------------------------

#[derive(Default)]
pub struct OpRegistry {
    pids: Mutex<HashMap<String, u32>>,
}

impl OpRegistry {
    pub fn register(&self, op_id: &str, pid: u32) {
        if let Ok(mut pids) = self.pids.lock() {
            pids.insert(op_id.to_string(), pid);
        }
    }

    pub fn unregister(&self, op_id: &str) {
        if let Ok(mut pids) = self.pids.lock() {
            pids.remove(op_id);
        }
    }

    pub fn is_running(&self, op_id: &str) -> bool {
        self.pids
            .lock()
            .map(|p| p.contains_key(op_id))
            .unwrap_or(false)
    }

    /// Kill one operation and every process it spawned. winget launches the
    /// real installer as a child, so killing only winget leaves it running.
    pub fn cancel(&self, op_id: &str) -> bool {
        let pid = match self.pids.lock() {
            Ok(mut pids) => pids.remove(op_id),
            Err(_) => None,
        };
        match pid {
            Some(pid) => kill_tree(pid),
            None => false,
        }
    }

    /// Used when the window closes so installs do not keep running invisibly.
    pub fn cancel_all(&self) {
        let pids: Vec<u32> = match self.pids.lock() {
            Ok(mut map) => map.drain().map(|(_, pid)| pid).collect(),
            Err(_) => Vec::new(),
        };
        for pid in pids {
            kill_tree(pid);
        }
    }
}

fn kill_tree(pid: u32) -> bool {
    std::process::Command::new("taskkill")
        .args(["/F", "/T", "/PID", &pid.to_string()])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

// ---------------------------------------------------------------------------
// Command execution
// ---------------------------------------------------------------------------

fn base_command() -> Command {
    let mut cmd = Command::new("winget");
    cmd.stdout(Stdio::piped()).stderr(Stdio::piped());
    #[cfg(windows)]
    {
        // CREATE_NO_WINDOW: keep console flashes from appearing behind the UI.
        cmd.creation_flags(0x0800_0000);
    }
    cmd
}

/// Run a read-only winget command to completion, with a timeout.
async fn run_capture(args: &[&str], timeout_secs: u64) -> Result<String, WingetError> {
    let mut cmd = base_command();
    cmd.args(args);

    let output = tokio::time::timeout(Duration::from_secs(timeout_secs), cmd.output())
        .await
        .map_err(|_| WingetError::Timeout(timeout_secs))??;

    if !output.status.success() {
        let stderr = decode(&output.stderr);
        let stdout = decode(&output.stdout);
        // winget frequently reports "no packages found" on stdout with a
        // non-zero status, so consider both streams.
        let combined = if stderr.trim().is_empty() {
            stdout
        } else {
            stderr
        };
        return Err(WingetError::from_exit(output.status.code(), &combined));
    }
    Ok(decode(&output.stdout))
}

/// Retry read-only commands that failed for transient reasons.
async fn run_capture_retrying(args: &[&str], timeout_secs: u64) -> Result<String, WingetError> {
    const BACKOFF_MS: [u64; 3] = [500, 2_000, 5_000];
    let mut last = WingetError::Io("no attempt made".into());
    for (attempt, delay) in BACKOFF_MS.iter().enumerate() {
        match run_capture(args, timeout_secs).await {
            Ok(out) => return Ok(out),
            Err(e) if e.is_retryable() && attempt + 1 < BACKOFF_MS.len() => {
                tracing::warn!(attempt, error = %e, "retrying winget command");
                tokio::time::sleep(Duration::from_millis(*delay)).await;
                last = e;
            }
            Err(e) => return Err(e),
        }
    }
    Err(last)
}

// ---------------------------------------------------------------------------
// Backend seam
// ---------------------------------------------------------------------------

/// The single seam between Wingman and whatever drives winget underneath.
///
/// Rust's async traits are not object-safe without an extra dependency, so the
/// seam is an enum rather than a `dyn Trait`. Adding a COM-based backend means
/// adding one variant and matching on it here — no call site changes.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Default)]
pub enum Backend {
    #[default]
    Cli,
}

/// Probe winget and return its version, or a typed error the UI can act on.
pub async fn check_available() -> Result<String, WingetError> {
    let out = run_capture(&["--version"], 15).await?;
    let version = out.trim().trim_start_matches('v').to_string();
    let mut parts = version.split('.');
    let major: u32 = parts.next().unwrap_or("0").parse().unwrap_or(0);
    let minor: u32 = parts.next().unwrap_or("0").parse().unwrap_or(0);
    if (major, minor) < MIN_SUPPORTED_VERSION {
        return Err(WingetError::Unsupported {
            found: version,
            minimum: format!("{}.{}", MIN_SUPPORTED_VERSION.0, MIN_SUPPORTED_VERSION.1),
        });
    }
    Ok(version)
}

pub async fn search(query: &str, source: Option<&str>) -> Result<Vec<Package>, WingetError> {
    validate_query(query)?;
    let query = query.trim();
    if query.is_empty() {
        return Ok(Vec::new());
    }
    let mut args = vec![
        "search",
        query,
        "--accept-source-agreements",
        "--disable-interactivity",
    ];
    if let Some(src) = source {
        args.push("--source");
        args.push(src);
    }
    match run_capture_retrying(&args, LIST_TIMEOUT_SECS).await {
        Ok(out) => Ok(rows_to_packages(parse_table(&out))),
        // "nothing matched" is an empty result, not a failure to surface.
        Err(WingetError::NotFound) => Ok(Vec::new()),
        Err(e) => Err(e),
    }
}

pub async fn list_installed() -> Result<Vec<Package>, WingetError> {
    let out = run_capture_retrying(
        &[
            "list",
            "--disable-interactivity",
            "--accept-source-agreements",
        ],
        LIST_TIMEOUT_SECS,
    )
    .await?;
    Ok(rows_to_packages(parse_table(&out)))
}

pub async fn list_upgradable() -> Result<Vec<Package>, WingetError> {
    let out = run_capture_retrying(
        &[
            "upgrade",
            "--include-unknown",
            "--disable-interactivity",
            "--accept-source-agreements",
        ],
        LIST_TIMEOUT_SECS,
    )
    .await?;
    Ok(rows_to_packages(parse_table(&out))
        .into_iter()
        .filter(|p| p.available.is_some())
        .collect())
}

pub async fn show(id: &str) -> Result<PackageDetails, WingetError> {
    validate_id(id)?;
    let out = run_capture_retrying(
        &[
            "show",
            "--id",
            id,
            "--exact",
            "--disable-interactivity",
            "--accept-source-agreements",
        ],
        LIST_TIMEOUT_SECS,
    )
    .await?;
    let mut details = parse_show(&out, id);
    if let Ok(versions_out) = run_capture(
        &[
            "show",
            "--id",
            id,
            "--exact",
            "--versions",
            "--disable-interactivity",
            "--accept-source-agreements",
        ],
        LIST_TIMEOUT_SECS,
    )
    .await
    {
        let parsed = parse_show(&versions_out, id);
        if !parsed.versions.is_empty() {
            details.versions = parsed.versions;
        }
    }
    Ok(details)
}

pub async fn export_list(path: &str) -> Result<(), WingetError> {
    run_capture_retrying(
        &[
            "export",
            "-o",
            path,
            "--accept-source-agreements",
            "--disable-interactivity",
        ],
        LIST_TIMEOUT_SECS,
    )
    .await
    .map(|_| ())
}

/// Build the argv for a mutating operation.
pub fn action_args<'a>(action: &'a str, id: &'a str, version: Option<&'a str>) -> Vec<&'a str> {
    let mut args = vec![
        action,
        "--id",
        id,
        "--exact",
        "--silent",
        "--accept-package-agreements",
        "--accept-source-agreements",
        "--disable-interactivity",
    ];
    if action == "uninstall" {
        // uninstall rejects --accept-package-agreements
        args.retain(|a| *a != "--accept-package-agreements");
    }
    if let Some(v) = version {
        args.push("--version");
        args.push(v);
    }
    args
}

/// Run a mutating winget operation, streaming both stdout and stderr.
///
/// The child pid is registered so `cancel` can kill the whole process tree.
pub async fn run_action(
    registry: &OpRegistry,
    op_id: &str,
    args: Vec<&str>,
    mut on_line: impl FnMut(ProgressLine) + Send,
) -> Result<(), WingetError> {
    let mut cmd = base_command();
    cmd.args(&args);
    let mut child = cmd.spawn()?;

    if let Some(pid) = child.id() {
        registry.register(op_id, pid);
    }

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| WingetError::Io("failed to capture stdout".into()))?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| WingetError::Io("failed to capture stderr".into()))?;

    // Both streams feed one channel so ordering stays roughly chronological and
    // a chatty stderr cannot deadlock a full stdout pipe.
    let (tx, mut rx) = mpsc::unbounded_channel::<(String, bool)>();
    let tx_err = tx.clone();

    tokio::spawn(async move {
        let mut lines = BufReader::new(stdout).lines();
        while let Ok(Some(line)) = lines.next_line().await {
            if tx.send((line, false)).is_err() {
                break;
            }
        }
    });
    tokio::spawn(async move {
        let mut lines = BufReader::new(stderr).lines();
        while let Ok(Some(line)) = lines.next_line().await {
            if tx_err.send((line, true)).is_err() {
                break;
            }
        }
    });

    let mut stderr_buf = String::new();
    while let Some((line, is_stderr)) = rx.recv().await {
        if is_stderr {
            stderr_buf.push_str(&line);
            stderr_buf.push('\n');
        }
        // winget rewrites the progress bar with \r, so one read can hold many
        // frames. Split them and keep only the last percentage.
        for chunk in line.split('\r') {
            if is_noise(chunk) {
                if let Some(pct) = parse_progress(chunk) {
                    on_line(ProgressLine {
                        line: String::new(),
                        percent: Some(pct),
                        is_stderr,
                    });
                }
                continue;
            }
            on_line(ProgressLine {
                line: chunk.trim_end().to_string(),
                percent: parse_progress(chunk),
                is_stderr,
            });
        }
    }

    let status = child.wait().await?;
    let was_cancelled = !registry.is_running(op_id);
    registry.unregister(op_id);

    if !status.success() {
        if was_cancelled {
            return Err(WingetError::Cancelled);
        }
        return Err(WingetError::from_exit(status.code(), &stderr_buf));
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
        let pkgs = rows_to_packages(parse_table(SAMPLE));
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
        let pkgs = rows_to_packages(parse_table(UPGRADE_SAMPLE));
        assert_eq!(pkgs.len(), 1);
        assert_eq!(pkgs[0].available.as_deref(), Some("24.05"));
    }

    const MATCH_SAMPLE: &str =
        "Name       Id                          Version  Match             Source
--------------------------------------------------------------------------
VS Code    Microsoft.VisualStudioCode  1.85.0   Moniker: vscode   winget
";

    #[test]
    fn parses_match_column() {
        let pkgs = rows_to_packages(parse_table(MATCH_SAMPLE));
        assert_eq!(pkgs.len(), 1);
        assert_eq!(pkgs[0].matched_on.as_deref(), Some("Moniker: vscode"));
    }

    const NO_SOURCE_SAMPLE: &str = "Name          Id              Version
-------------------------------------------
Some Local    Local.Thing     1.0.0
";

    #[test]
    fn parses_table_without_source_column() {
        let pkgs = rows_to_packages(parse_table(NO_SOURCE_SAMPLE));
        assert_eq!(pkgs.len(), 1);
        assert_eq!(pkgs[0].id, "Local.Thing");
        assert!(pkgs[0].source.is_none());
    }

    #[test]
    fn parses_table_buried_after_carriage_returns() {
        let noisy = format!("  -  \\  |  /  ████▒▒  50%\r{SAMPLE}");
        let pkgs = rows_to_packages(parse_table(&noisy));
        assert_eq!(pkgs.len(), 2);
    }

    #[test]
    fn handles_cjk_names() {
        let sample = "Name        Id              Version  Source
------------------------------------------------
微信         Tencent.WeChat  3.9.0    winget
";
        let pkgs = rows_to_packages(parse_table(sample));
        assert_eq!(pkgs.len(), 1);
        assert_eq!(pkgs[0].id, "Tencent.WeChat");
    }

    #[test]
    fn empty_output_yields_no_rows() {
        assert!(parse_table("").is_empty());
        assert!(parse_table("No installed package found matching input criteria.").is_empty());
    }

    #[test]
    fn parses_progress_percentages() {
        assert_eq!(parse_progress("████▒▒▒▒  42%"), Some(42));
        assert_eq!(parse_progress("  100%"), Some(100));
        assert_eq!(parse_progress("no percent here"), None);
        assert_eq!(parse_progress("120%"), Some(100));
    }

    #[test]
    fn detects_noise_lines() {
        assert!(is_noise("   -    \\    |    /   "));
        assert!(is_noise("██████▒▒▒▒  33%"));
        assert!(is_noise("   "));
        assert!(!is_noise("Successfully installed"));
    }

    #[test]
    fn rejects_flag_like_ids() {
        assert!(validate_id("--version").is_err());
        assert!(validate_id("").is_err());
        assert!(validate_id("Microsoft.VisualStudioCode").is_ok());
    }

    #[test]
    fn uninstall_args_drop_package_agreements() {
        let args = action_args("uninstall", "Foo.Bar", None);
        assert!(!args.contains(&"--accept-package-agreements"));
        assert!(args.contains(&"--silent"));
    }

    #[test]
    fn install_args_can_pin_a_version() {
        let args = action_args("install", "Foo.Bar", Some("1.2.3"));
        assert!(args.windows(2).any(|w| w == ["--version", "1.2.3"]));
    }

    #[test]
    fn parses_show_output() {
        let out = "Found Visual Studio Code [Microsoft.VisualStudioCode]
Version: 1.85.0
Publisher: Microsoft Corporation
Description: Visual Studio Code is a lightweight but powerful source code editor
Homepage: https://code.visualstudio.com
License: MIT
";
        let d = parse_show(out, "Microsoft.VisualStudioCode");
        assert_eq!(d.name, "Visual Studio Code");
        assert_eq!(d.publisher.as_deref(), Some("Microsoft Corporation"));
        assert_eq!(d.homepage.as_deref(), Some("https://code.visualstudio.com"));
        assert_eq!(d.license.as_deref(), Some("MIT"));
    }

    #[test]
    fn search_cache_round_trips_and_evicts() {
        let cache = SearchCache::default();
        let pkg = Package {
            name: "A".into(),
            id: "A.A".into(),
            version: "1".into(),
            available: None,
            source: None,
            matched_on: None,
        };
        cache.put("q".into(), vec![pkg.clone()]);
        assert_eq!(cache.get("q"), Some(vec![pkg]));
        assert_eq!(cache.get("missing"), None);

        for i in 0..SEARCH_CACHE_CAPACITY + 5 {
            cache.put(format!("k{i}"), Vec::new());
        }
        assert!(cache.get("q").is_none(), "oldest entry should be evicted");
    }

    #[test]
    fn decodes_utf16_with_bom() {
        let mut bytes = vec![0xFF, 0xFE];
        for c in "hi".encode_utf16() {
            bytes.extend_from_slice(&c.to_le_bytes());
        }
        assert_eq!(decode(&bytes), "hi");
    }
}
