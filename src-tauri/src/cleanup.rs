//! Deep-clean uninstall: find and remove what an uninstaller left behind.
//!
//! Everything here is built around four rules:
//!
//! 1. **Snapshot before, scan after.** The registry uninstall entry (with its
//!    `InstallLocation`) disappears when the uninstaller runs, so it is
//!    captured *before* the uninstall and used for matching afterwards.
//! 2. **Nothing is deleted without a preview.** Scanning and deleting are
//!    separate commands; the UI shows every candidate and the user picks.
//! 3. **Deletions are recoverable.** Folders and shortcuts go to the Recycle
//!    Bin; registry keys are exported to a `.reg` backup before removal.
//! 4. **The frontend never supplies a path.** Scan results live in this
//!    process keyed by opaque ids; the clean command accepts only those ids,
//!    so a compromised webview cannot request an arbitrary deletion.

use serde::Serialize;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use winreg::enums::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE, KEY_READ};
use winreg::RegKey;

const SESSION_TTL: Duration = Duration::from_secs(30 * 60);
/// Stop sizing a directory after this many entries; the display shows "large".
const SIZE_WALK_CAP: usize = 20_000;
const MIN_MATCH_LEN: usize = 3;

/// Names that must never be offered for deletion on their own: deleting any of
/// these directories or keys wholesale would take unrelated software with it.
const DENY_NAMES: &[&str] = &[
    "microsoft",
    "windows",
    "windows nt",
    "common files",
    "commonfiles",
    "programs",
    "program files",
    "packages",
    "classes",
    "policies",
    "wow6432node",
    "clients",
    "software",
    "system",
    "system32",
    "syswow64",
    "temp",
    "tmp",
    "cache",
    "local",
    "locallow",
    "roaming",
    "users",
    "default",
    "public",
    "desktop",
    "start menu",
    "startup",
    "app",
    "apps",
    "application",
    "data",
    "appdata",
    "config",
    "settings",
    "setup",
    "installer",
    "install",
    "runtimes",
    "shared",
    "wingman",
    // Shell folders and shared trees an InstallLocation can point at.
    "documents",
    "downloads",
    "pictures",
    "music",
    "videos",
    "onedrive",
    "favorites",
    "contacts",
    "links",
    "searches",
    "saved games",
    "steamapps",
    "steamlibrary",
    "common",
    "games",
    "bin",
    "lib",
    "src",
    "tools",
    "drivers",
    "fonts",
    "help",
    "logs",
    "backup",
    "backups",
    // Big multi-product publishers: offer their *sub*-keys, never the whole node.
    "google",
    "intel",
    "nvidia",
    "amd",
    "adobe",
    "apple",
    "oracle",
    "mozilla",
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Hive {
    Hkcu,
    Hklm,
}

impl Hive {
    fn key(self) -> RegKey {
        match self {
            Hive::Hkcu => RegKey::predef(HKEY_CURRENT_USER),
            Hive::Hklm => RegKey::predef(HKEY_LOCAL_MACHINE),
        }
    }

    fn display(self) -> &'static str {
        match self {
            Hive::Hkcu => "HKCU",
            Hive::Hklm => "HKLM",
        }
    }

    fn reg_exe_name(self) -> &'static str {
        match self {
            Hive::Hkcu => "HKEY_CURRENT_USER",
            Hive::Hklm => "HKEY_LOCAL_MACHINE",
        }
    }
}

#[derive(Debug, Clone)]
pub enum Target {
    Dir(PathBuf),
    Shortcut(PathBuf),
    RegKey {
        hive: Hive,
        path: String,
    },
    RegValue {
        hive: Hive,
        key: String,
        value: String,
    },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Reason {
    InstallLocation,
    NameMatch,
    PublisherOnly,
    ArpLeftover,
    RunKey,
    ShortcutMatch,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Confidence {
    High,
    Medium,
}

#[derive(Debug, Clone)]
pub struct Leftover {
    pub id: String,
    pub target: Target,
    pub size_bytes: Option<u64>,
    pub reason: Reason,
    pub confidence: Confidence,
    pub requires_admin: bool,
}

/// What the uninstall entry said about the app while it still existed.
#[derive(Debug, Clone, Default)]
pub struct ArpSnapshot {
    pub display_name: Option<String>,
    pub publisher: Option<String>,
    pub install_location: Option<PathBuf>,
    pub uninstall_key: Option<(Hive, String)>,
}

#[derive(Debug, Clone)]
pub struct ArpEntry {
    hive: Hive,
    key_path: String,
    display_name: String,
    publisher: Option<String>,
    install_location: Option<String>,
}

struct Session {
    snapshot: ArpSnapshot,
    hint_name: String,
    items: Vec<Leftover>,
    created: Instant,
}

#[derive(Default)]
pub struct CleanupStore {
    sessions: Mutex<HashMap<String, Session>>,
}

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LeftoverDto {
    pub id: String,
    pub kind: &'static str,
    pub path: String,
    pub size_bytes: Option<u64>,
    pub reason: Reason,
    pub confidence: Confidence,
    pub requires_admin: bool,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ScanResultDto {
    pub items: Vec<LeftoverDto>,
    pub elevated: bool,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CleanItemResultDto {
    pub id: String,
    pub ok: bool,
    pub needs_admin: bool,
    pub error: Option<String>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CleanResultDto {
    pub results: Vec<CleanItemResultDto>,
    pub backup_dir: Option<String>,
}

fn to_dto(item: &Leftover) -> LeftoverDto {
    let (kind, path) = match &item.target {
        Target::Dir(p) => ("folder", p.display().to_string()),
        Target::Shortcut(p) => ("shortcut", p.display().to_string()),
        Target::RegKey { hive, path } => ("registryKey", format!("{}\\{}", hive.display(), path)),
        Target::RegValue { hive, key, value } => (
            "registryValue",
            format!("{}\\{} → {}", hive.display(), key, value),
        ),
    };
    LeftoverDto {
        id: item.id.clone(),
        kind,
        path,
        size_bytes: item.size_bytes,
        reason: item.reason,
        confidence: item.confidence,
        requires_admin: item.requires_admin,
    }
}

// ---------------------------------------------------------------------------
// Pure helpers (unit-tested)
// ---------------------------------------------------------------------------

/// Strip version numbers, architecture tags and trademark noise from a display
/// name, leaving the part users (and folders) actually call the app.
/// `"7-Zip 23.01 (x64)"` → `"7-Zip"`.
pub fn sanitize_name(raw: &str) -> String {
    let cleaned: String = raw
        .chars()
        .filter(|c| !matches!(c, '™' | '®' | '©'))
        .collect();

    let mut kept: Vec<&str> = Vec::new();
    for token in cleaned.split_whitespace() {
        let lower = token.to_lowercase();
        let bare = lower.trim_matches(|c| c == '(' || c == ')');
        let is_version = !bare.is_empty()
            && bare
                .trim_start_matches('v')
                .chars()
                .all(|c| c.is_ascii_digit() || c == '.')
            && bare
                .trim_start_matches('v')
                .chars()
                .any(|c| c.is_ascii_digit());
        let is_arch = matches!(
            bare,
            "x64" | "x86" | "amd64" | "arm64" | "64-bit" | "32-bit" | "64bit" | "32bit"
        );
        if is_version || is_arch {
            continue;
        }
        kept.push(token);
    }
    kept.join(" ")
        .trim_end_matches(['-', '–', ' '])
        .trim()
        .to_string()
}

/// A name we refuse to act on as a standalone folder or key.
pub fn is_deny_listed(name: &str) -> bool {
    let lower = name.trim().to_lowercase();
    lower.len() < MIN_MATCH_LEN || DENY_NAMES.contains(&lower.as_str())
}

/// Canonical lowercase form used for every path comparison.
///
/// This must not be a plain lowercase: Windows accepts `C:/Program Files`,
/// `C:\Program Files\` and `C:\Program Files.` as the same directory, so a
/// comparison that only lowercases lets any of those slip past a guard that
/// was written with backslashes. Separators are unified, repeated separators
/// collapsed, and the trailing dots/spaces Windows silently strips are removed
/// from every component.
fn norm(path: &Path) -> String {
    let raw = path.to_string_lossy().replace('/', "\\");
    let mut out = String::with_capacity(raw.len());
    for (index, component) in raw.split('\\').enumerate() {
        // A leading `\\` (UNC) keeps its empty first component.
        if component.is_empty() && index > 0 {
            continue;
        }
        // Windows drops trailing dots and spaces from every path component —
        // but `.` and `..` are real components and must survive untouched, or
        // a relative path would silently normalise into its own parent.
        let cleaned = if component == "." || component == ".." {
            component
        } else {
            component.trim_end_matches([' ', '.'])
        };
        if index > 0 {
            out.push('\\');
        }
        out.push_str(cleaned);
    }
    while out.ends_with('\\') {
        out.pop();
    }
    out.to_lowercase()
}

/// The last component of a path, canonicalised the same way `norm` does.
fn leaf_of(path: &Path) -> Option<String> {
    norm(path).rsplit('\\').next().map(str::to_string)
}

fn env_dir(var: &str) -> Option<PathBuf> {
    std::env::var_os(var)
        .map(PathBuf::from)
        .filter(|p| p.is_dir())
}

/// Directory trees that must never be offered or deleted, no matter what the
/// matcher thinks. `(path, protect_whole_subtree)`.
fn protected_prefixes() -> Vec<(PathBuf, bool)> {
    let mut out: Vec<(PathBuf, bool)> = Vec::new();
    // Whole subtrees.
    if let Some(w) = std::env::var_os("WINDIR") {
        out.push((PathBuf::from(w), true));
    }
    // Wingman's own data, including the registry backups written moments ago.
    if let Some(dir) = crate::logging::log_dir().parent() {
        out.push((dir.to_path_buf(), true));
    }
    if let Some(d) = std::env::var_os("LOCALAPPDATA") {
        out.push((PathBuf::from(d).join("Wingman"), true));
    }
    // The user's own document folders: an installer that points its
    // InstallLocation at one of these must not take it with it.
    if let Some(profile) = std::env::var_os("USERPROFILE").map(PathBuf::from) {
        for folder in [
            "Documents",
            "Downloads",
            "Desktop",
            "Pictures",
            "Music",
            "Videos",
            "OneDrive",
            "Saved Games",
            "Favorites",
            "Contacts",
            "Links",
            "Searches",
        ] {
            out.push((profile.join(folder), false));
        }
    }
    // Roots: the directory itself is untouchable, children are fair game.
    for var in [
        "USERPROFILE",
        "LOCALAPPDATA",
        "APPDATA",
        "PROGRAMDATA",
        "ProgramFiles",
        "ProgramFiles(x86)",
        "ProgramW6432",
        "PUBLIC",
    ] {
        if let Some(d) = std::env::var_os(var) {
            out.push((PathBuf::from(d), false));
        }
    }
    out
}

/// True when `path` may not be deleted: a bare drive, a protected subtree, or
/// one of the well-known roots themselves.
pub fn is_protected_path(path: &Path) -> bool {
    let n = norm(path);
    // "c:" / "c:\" and anything without a parent.
    if n.len() <= 3 || path.parent().is_none() {
        return true;
    }
    // A path must sit at least one level below a drive root: `C:\Foo` is two
    // components, which is the shallowest thing we will ever consider.
    let segments: Vec<&str> = n.split('\\').filter(|s| !s.is_empty()).collect();
    if segments.len() < 2 {
        return true;
    }
    // Relative components make a path impossible to reason about by string
    // comparison — `C:\Foo\..` is really `C:\`. Refuse rather than resolve.
    if segments.iter().any(|s| *s == "." || *s == "..") {
        return true;
    }
    for (prefix, whole_subtree) in protected_prefixes() {
        let p = norm(&prefix);
        if p.is_empty() {
            continue;
        }
        if n == p {
            return true;
        }
        if whole_subtree && n.starts_with(&format!("{p}\\")) {
            return true;
        }
    }
    // The final component must itself be a plausible app name — never a
    // generic or shared directory. `is_deny_listed` also enforces the minimum
    // length. This is the check that stops an InstallLocation of
    // `C:\Program Files\Common Files` or `C:\ProgramData\Microsoft` from being
    // offered whole, since those never pass through name-based filtering.
    match leaf_of(path) {
        Some(leaf) => is_deny_listed(&leaf),
        None => true,
    }
}

/// An `InstallLocation` from the registry, accepted only if it is a real
/// directory we would be willing to delete. Every consumer must go through
/// this rather than trusting the raw registry string.
fn vetted_install_location(snapshot: &ArpSnapshot) -> Option<PathBuf> {
    let loc = snapshot.install_location.as_ref()?;
    if !loc.is_dir() || is_protected_path(loc) {
        if snapshot.install_location.is_some() {
            tracing::debug!(path = %loc.display(), "ignoring unusable InstallLocation");
        }
        return None;
    }
    Some(loc.clone())
}

/// A registry subkey we are willing to touch: under Software, at least two
/// levels deep (never `Software\X` where X is deny-listed), and never inside
/// `Software\Microsoft`.
pub fn is_safe_reg_subkey(path: &str) -> bool {
    let lower = path.to_lowercase();
    let segments: Vec<&str> = lower.split('\\').filter(|s| !s.is_empty()).collect();
    if segments.len() < 2 {
        return false;
    }
    let under_software =
        segments[0] == "software" || (segments[0] == "software" && segments[1] == "wow6432node");
    if !under_software {
        return false;
    }
    let mut idx = 1;
    if segments.get(1) == Some(&"wow6432node") {
        idx = 2;
    }
    let Some(first_vendor_level) = segments.get(idx) else {
        return false;
    };
    if *first_vendor_level == "microsoft" {
        // Uninstall entries under Software\Microsoft\Windows\...\Uninstall are
        // the one sanctioned exception; anything else under Microsoft is out.
        return lower.contains("\\currentversion\\uninstall\\")
            && segments
                .last()
                .is_some_and(|leaf| leaf.len() >= MIN_MATCH_LEN);
    }
    // The leaf we would delete must not be a deny-listed name on its own.
    segments.last().is_some_and(|leaf| !is_deny_listed(leaf))
}

/// First executable path out of a Run-key command line.
pub fn extract_exe(command: &str) -> Option<PathBuf> {
    let expanded = expand_env(command.trim());
    let candidate = if let Some(rest) = expanded.strip_prefix('"') {
        rest.split('"').next().unwrap_or_default().to_string()
    } else {
        expanded
            .split_whitespace()
            .next()
            .unwrap_or_default()
            .to_string()
    };
    if candidate.len() < 4 {
        return None;
    }
    Some(PathBuf::from(candidate))
}

/// Minimal `%VAR%` expansion — enough for the values Run keys actually hold.
fn expand_env(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut rest = s;
    while let Some(start) = rest.find('%') {
        out.push_str(&rest[..start]);
        let after = &rest[start + 1..];
        match after.find('%') {
            Some(end) => {
                let var = &after[..end];
                match std::env::var(var) {
                    Ok(value) => out.push_str(&value),
                    Err(_) => {
                        out.push('%');
                        out.push_str(var);
                        out.push('%');
                    }
                }
                rest = &after[end + 1..];
            }
            None => {
                out.push('%');
                rest = after;
            }
        }
    }
    out.push_str(rest);
    out
}

/// Pick the uninstall entry that best matches the winget package name.
pub fn best_arp_match<'a>(entries: &'a [ArpEntry], wanted: &str) -> Option<&'a ArpEntry> {
    let wanted_lower = wanted.trim().to_lowercase();
    let wanted_sanitized = sanitize_name(wanted).to_lowercase();
    if wanted_lower.len() < MIN_MATCH_LEN {
        return None;
    }
    entries
        .iter()
        .map(|e| {
            let dn = e.display_name.to_lowercase();
            let dn_sanitized = sanitize_name(&e.display_name).to_lowercase();
            let score = if dn == wanted_lower {
                4
            } else if dn_sanitized == wanted_sanitized && !dn_sanitized.is_empty() {
                3
            } else if starts_with_word(&dn, &wanted_lower) {
                2
            } else {
                0
            };
            (score, e)
        })
        .filter(|(score, _)| *score > 0)
        .max_by_key(|(score, _)| *score)
        .map(|(_, e)| e)
}

/// `haystack` begins with `needle` followed by a word boundary.
///
/// A bare `starts_with` matches "Git" against "GitHub Desktop", which would
/// make an unrelated product's InstallLocation the cleanup target. Requiring a
/// separator after the prefix keeps "Git" → "Git version 2.40" while rejecting
/// "GitHub Desktop". A plain `contains` was dropped for the same reason.
fn starts_with_word(haystack: &str, needle: &str) -> bool {
    let Some(rest) = haystack.strip_prefix(needle) else {
        return false;
    };
    match rest.chars().next() {
        None => true,
        Some(c) => !c.is_alphanumeric(),
    }
}

/// Total bytes under `path`, or `None` when it cannot be measured.
///
/// Returning `None` rather than `0` matters: a folder we lack permission to
/// read would otherwise be shown as "0 B" next to a delete checkbox, telling
/// the user they are freeing nothing when they may be freeing gigabytes.
fn dir_size(path: &Path) -> Option<u64> {
    // If the top level cannot be read, we know nothing about the size.
    std::fs::read_dir(path).ok()?;

    let mut total: u64 = 0;
    let mut seen: usize = 0;
    let mut stack = vec![path.to_path_buf()];
    while let Some(dir) = stack.pop() {
        let Ok(entries) = std::fs::read_dir(&dir) else {
            continue;
        };
        for entry in entries.flatten() {
            seen += 1;
            if seen > SIZE_WALK_CAP {
                return Some(total);
            }
            let Ok(meta) = entry.metadata() else { continue };
            if meta.is_dir() {
                stack.push(entry.path());
            } else {
                total += meta.len();
            }
        }
    }
    Some(total)
}

// ---------------------------------------------------------------------------
// Registry enumeration
// ---------------------------------------------------------------------------

const UNINSTALL_ROOTS: &[(Hive, &str)] = &[
    (
        Hive::Hklm,
        "SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
    ),
    (
        Hive::Hklm,
        "SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
    ),
    (
        Hive::Hkcu,
        "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
    ),
];

fn collect_arp_entries() -> Vec<ArpEntry> {
    let mut out = Vec::new();
    for (hive, root) in UNINSTALL_ROOTS {
        let Ok(key) = hive.key().open_subkey_with_flags(root, KEY_READ) else {
            continue;
        };
        for name in key.enum_keys().flatten() {
            let Ok(sub) = key.open_subkey_with_flags(&name, KEY_READ) else {
                continue;
            };
            let Ok(display_name) = sub.get_value::<String, _>("DisplayName") else {
                continue;
            };
            out.push(ArpEntry {
                hive: *hive,
                key_path: format!("{root}\\{name}"),
                display_name,
                publisher: sub.get_value::<String, _>("Publisher").ok(),
                install_location: sub
                    .get_value::<String, _>("InstallLocation")
                    .ok()
                    .filter(|s| !s.trim().is_empty()),
            });
        }
    }
    out
}

/// Capture what we will need after the uninstall erases it.
pub fn capture_snapshot(hint_name: &str) -> ArpSnapshot {
    let entries = collect_arp_entries();
    match best_arp_match(&entries, hint_name) {
        Some(entry) => ArpSnapshot {
            display_name: Some(entry.display_name.clone()),
            publisher: entry.publisher.clone(),
            install_location: entry
                .install_location
                .as_ref()
                .map(|s| PathBuf::from(s.trim_matches('"'))),
            uninstall_key: Some((entry.hive, entry.key_path.clone())),
        },
        None => ArpSnapshot::default(),
    }
}

/// Elevation probe: only an elevated process can write HKLM\SOFTWARE.
pub fn is_elevated() -> bool {
    use winreg::enums::KEY_WRITE;
    RegKey::predef(HKEY_LOCAL_MACHINE)
        .open_subkey_with_flags("SOFTWARE", KEY_WRITE)
        .is_ok()
}

// ---------------------------------------------------------------------------
// Scan
// ---------------------------------------------------------------------------

struct ScanCtx {
    items: Vec<Leftover>,
    seen: Vec<String>,
    next_id: usize,
    /// Prefix that makes item ids unique across scans of the same package.
    id_prefix: String,
    /// Sanitized names of every *other* app still installed. A folder, key or
    /// shortcut carrying one of these names belongs to software the user still
    /// has, so it is never offered — a small app called "Word" must not put
    /// Microsoft Word's shortcut on the chopping block.
    other_app_names: Vec<String>,
}

impl ScanCtx {
    fn claimed_by_another_app(&self, name: &str) -> bool {
        let candidate = sanitize_name(name).to_lowercase();
        if candidate.is_empty() {
            return false;
        }
        self.other_app_names.contains(&candidate)
    }

    fn push(&mut self, target: Target, reason: Reason, confidence: Confidence, admin: bool) {
        let dedup_key = match &target {
            Target::Dir(p) | Target::Shortcut(p) => norm(p),
            Target::RegKey { hive, path } => format!("{}\\{}", hive.display(), path.to_lowercase()),
            Target::RegValue { hive, key, value } => format!(
                "{}\\{}::{}",
                hive.display(),
                key.to_lowercase(),
                value.to_lowercase()
            ),
        };
        if self.seen.contains(&dedup_key) {
            return;
        }
        self.seen.push(dedup_key);
        let size_bytes = match &target {
            Target::Dir(p) => dir_size(p),
            _ => None,
        };
        self.items.push(Leftover {
            // Scoped by scan, so ids from a stale dialog can never resolve
            // against the items of a later scan.
            id: format!("{}-{}", self.id_prefix, self.next_id),
            target,
            size_bytes,
            reason,
            confidence,
            requires_admin: admin,
        });
        self.next_id += 1;
    }
}

/// Folder roots worth scanning, with whether deleting inside them normally
/// needs elevation.
fn folder_roots() -> Vec<(PathBuf, bool)> {
    let mut roots = Vec::new();
    if let Some(p) = env_dir("LOCALAPPDATA") {
        roots.push((p.clone(), false));
        roots.push((p.join("Programs"), false));
    }
    if let Some(p) = env_dir("APPDATA") {
        roots.push((p, false));
    }
    if let Some(p) = env_dir("PROGRAMDATA") {
        roots.push((p, false));
    }
    for var in ["ProgramFiles", "ProgramFiles(x86)", "ProgramW6432"] {
        if let Some(p) = env_dir(var) {
            roots.push((p, true));
        }
    }
    roots.sort();
    roots.dedup();
    roots
}

fn dir_has_single_child(path: &Path, child: &str) -> bool {
    let Ok(entries) = std::fs::read_dir(path) else {
        return false;
    };
    let mut count = 0;
    let mut matched = false;
    for entry in entries.flatten() {
        count += 1;
        if count > 1 {
            return false;
        }
        matched = entry
            .file_name()
            .to_string_lossy()
            .eq_ignore_ascii_case(child);
    }
    count == 1 && matched
}

fn scan_folders(ctx: &mut ScanCtx, leafs: &[String], publishers: &[String]) {
    for (root, admin) in folder_roots() {
        for leaf in leafs {
            if ctx.claimed_by_another_app(leaf) {
                continue;
            }
            let direct = root.join(leaf);
            if direct.is_dir() && !is_protected_path(&direct) {
                ctx.push(
                    Target::Dir(direct),
                    Reason::NameMatch,
                    Confidence::High,
                    admin,
                );
            }
            for publisher in publishers {
                if is_deny_listed(publisher) {
                    // Never offer the vendor node itself, but its app child is fine.
                    let child = root.join(publisher).join(leaf);
                    if child.is_dir() && !is_protected_path(&child) {
                        ctx.push(
                            Target::Dir(child),
                            Reason::NameMatch,
                            Confidence::High,
                            admin,
                        );
                    }
                    continue;
                }
                let vendor = root.join(publisher);
                let child = vendor.join(leaf);
                if !child.is_dir() {
                    continue;
                }
                if dir_has_single_child(&vendor, leaf) && !is_protected_path(&vendor) {
                    // The vendor dir holds nothing but this app: take it whole.
                    ctx.push(
                        Target::Dir(vendor),
                        Reason::PublisherOnly,
                        Confidence::High,
                        admin,
                    );
                } else if !is_protected_path(&child) {
                    ctx.push(
                        Target::Dir(child),
                        Reason::NameMatch,
                        Confidence::High,
                        admin,
                    );
                }
            }
        }
    }
}

const SOFTWARE_ROOTS: &[(Hive, &str, bool)] = &[
    (Hive::Hkcu, "Software", false),
    (Hive::Hklm, "SOFTWARE", true),
    (Hive::Hklm, "SOFTWARE\\WOW6432Node", true),
];

fn reg_key_exists(hive: Hive, path: &str) -> bool {
    hive.key().open_subkey_with_flags(path, KEY_READ).is_ok()
}

fn reg_key_single_child(hive: Hive, path: &str, child: &str) -> bool {
    match hive.key().open_subkey_with_flags(path, KEY_READ) {
        Ok(key) => {
            if key.enum_values().next().is_some() {
                return false;
            }
            let mut keys = key.enum_keys().flatten();
            match (keys.next(), keys.next()) {
                (Some(only), None) => only.eq_ignore_ascii_case(child),
                _ => false,
            }
        }
        Err(_) => false,
    }
}

fn scan_registry(ctx: &mut ScanCtx, leafs: &[String], publishers: &[String]) {
    for (hive, root, admin) in SOFTWARE_ROOTS {
        for leaf in leafs {
            if ctx.claimed_by_another_app(leaf) {
                continue;
            }
            let direct = format!("{root}\\{leaf}");
            if reg_key_exists(*hive, &direct) && is_safe_reg_subkey(&direct) {
                ctx.push(
                    Target::RegKey {
                        hive: *hive,
                        path: direct,
                    },
                    Reason::NameMatch,
                    Confidence::High,
                    *admin,
                );
            }
            for publisher in publishers {
                let vendor = format!("{root}\\{publisher}");
                let child = format!("{vendor}\\{leaf}");
                if !reg_key_exists(*hive, &child) {
                    continue;
                }
                if !is_deny_listed(publisher)
                    && reg_key_single_child(*hive, &vendor, leaf)
                    && is_safe_reg_subkey(&vendor)
                {
                    ctx.push(
                        Target::RegKey {
                            hive: *hive,
                            path: vendor,
                        },
                        Reason::PublisherOnly,
                        Confidence::High,
                        *admin,
                    );
                } else if is_safe_reg_subkey(&child) {
                    ctx.push(
                        Target::RegKey {
                            hive: *hive,
                            path: child,
                        },
                        Reason::NameMatch,
                        Confidence::High,
                        *admin,
                    );
                }
            }
        }
    }
}

const RUN_KEY: &str = "Software\\Microsoft\\Windows\\CurrentVersion\\Run";

fn scan_run_keys(ctx: &mut ScanCtx, leafs: &[String], install_location: Option<&Path>) {
    for (hive, admin) in [(Hive::Hkcu, false), (Hive::Hklm, true)] {
        let Ok(key) = hive.key().open_subkey_with_flags(RUN_KEY, KEY_READ) else {
            continue;
        };
        let names: Vec<String> = key.enum_values().flatten().map(|(name, _)| name).collect();
        for name in names {
            let Ok(command) = key.get_value::<String, _>(&name) else {
                continue;
            };
            let Some(exe) = extract_exe(&command) else {
                continue;
            };
            let exe_missing = !exe.exists();
            let in_install_dir = install_location
                .is_some_and(|loc| norm(&exe).starts_with(&format!("{}\\", norm(loc))));
            let name_matches = !ctx.claimed_by_another_app(&name)
                && leafs.iter().any(|leaf| {
                    name.eq_ignore_ascii_case(leaf)
                        || sanitize_name(&name).eq_ignore_ascii_case(leaf)
                });
            if in_install_dir || (exe_missing && name_matches) {
                ctx.push(
                    Target::RegValue {
                        hive,
                        key: RUN_KEY.to_string(),
                        value: name,
                    },
                    Reason::RunKey,
                    if in_install_dir {
                        Confidence::High
                    } else {
                        Confidence::Medium
                    },
                    admin,
                );
            }
        }
    }
}

fn shortcut_dirs() -> Vec<(PathBuf, bool)> {
    let mut out = Vec::new();
    if let Some(p) = env_dir("APPDATA") {
        out.push((p.join("Microsoft\\Windows\\Start Menu\\Programs"), false));
    }
    if let Some(p) = env_dir("PROGRAMDATA") {
        out.push((p.join("Microsoft\\Windows\\Start Menu\\Programs"), true));
    }
    if let Some(p) = env_dir("USERPROFILE") {
        out.push((p.join("Desktop"), false));
    }
    if let Some(p) = env_dir("PUBLIC") {
        out.push((p.join("Desktop"), true));
    }
    out
}

fn scan_shortcuts(ctx: &mut ScanCtx, leafs: &[String]) {
    for (dir, admin) in shortcut_dirs() {
        // Two levels: Programs\Foo.lnk and Programs\Vendor\Foo.lnk.
        let mut candidates: Vec<PathBuf> = Vec::new();
        if let Ok(entries) = std::fs::read_dir(&dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path
                    .extension()
                    .is_some_and(|e| e.eq_ignore_ascii_case("lnk"))
                {
                    candidates.push(path);
                } else if path.is_dir() {
                    if let Ok(inner) = std::fs::read_dir(&path) {
                        for e in inner.flatten() {
                            let p = e.path();
                            if p.extension().is_some_and(|e| e.eq_ignore_ascii_case("lnk")) {
                                candidates.push(p);
                            }
                        }
                    }
                }
            }
        }
        for lnk in candidates {
            let Some(stem) = lnk.file_stem().map(|s| s.to_string_lossy().to_string()) else {
                continue;
            };
            let stem_clean = sanitize_name(&stem);
            if ctx.claimed_by_another_app(&stem) {
                continue;
            }
            if leafs.iter().any(|leaf| {
                stem_clean.eq_ignore_ascii_case(leaf) || stem.eq_ignore_ascii_case(leaf)
            }) {
                ctx.push(
                    Target::Shortcut(lnk),
                    Reason::ShortcutMatch,
                    Confidence::High,
                    admin,
                );
            }
        }
    }
}

/// Build the candidate name lists from every signal we have.
fn matching_names(
    hint_name: &str,
    snapshot: &ArpSnapshot,
    package_id: &str,
) -> (Vec<String>, Vec<String>) {
    let mut leafs: Vec<String> = Vec::new();
    let push_unique = |list: &mut Vec<String>, value: String| {
        let trimmed = value.trim().to_string();
        if trimmed.len() >= MIN_MATCH_LEN
            && !is_deny_listed(&trimmed)
            && !list.iter().any(|x| x.eq_ignore_ascii_case(&trimmed))
            && !trimmed.contains(['\\', '/', ':'])
        {
            list.push(trimmed);
        }
    };

    push_unique(&mut leafs, sanitize_name(hint_name));
    push_unique(&mut leafs, hint_name.to_string());
    if let Some(dn) = &snapshot.display_name {
        push_unique(&mut leafs, sanitize_name(dn));
    }
    // "Publisher.Name" ids carry a usable name in their last segment.
    if let Some(last) = package_id.rsplit('.').next() {
        if last.chars().any(|c| c.is_ascii_alphabetic()) {
            push_unique(&mut leafs, last.to_string());
        }
    }

    // Publishers are only ever used as the *parent* of a candidate, never as a
    // target on their own, so deny-listed vendors belong here: "Google" must
    // reach the scanner for `…\Google\Chrome` to be found, while the deny-list
    // is what stops `…\Google` itself from being offered.
    let mut publishers: Vec<String> = Vec::new();
    let push_parent = |list: &mut Vec<String>, value: String| {
        let trimmed = value.trim().to_string();
        if trimmed.len() >= MIN_MATCH_LEN
            && !list.iter().any(|x| x.eq_ignore_ascii_case(&trimmed))
            && !trimmed.contains(['\\', '/', ':'])
        {
            list.push(trimmed);
        }
    };
    if let Some(publisher) = &snapshot.publisher {
        push_parent(&mut publishers, sanitize_name(publisher));
        push_parent(&mut publishers, publisher.clone());
    }
    if let Some(first) = package_id.split('.').next() {
        push_parent(&mut publishers, first.to_string());
    }
    (leafs, publishers)
}

pub fn scan(package_id: &str, hint_name: &str, snapshot: &ArpSnapshot) -> Vec<Leftover> {
    // Names of everything else still installed, so nothing belonging to
    // software the user kept can be offered.
    let own_key = snapshot.uninstall_key.as_ref();
    let other_app_names: Vec<String> = collect_arp_entries()
        .into_iter()
        .filter(|entry| {
            own_key.is_none_or(|(hive, path)| {
                entry.hive != *hive || !entry.key_path.eq_ignore_ascii_case(path)
            })
        })
        .map(|entry| sanitize_name(&entry.display_name).to_lowercase())
        .filter(|name| !name.is_empty())
        .collect();

    let mut ctx = ScanCtx {
        items: Vec::new(),
        seen: Vec::new(),
        next_id: 0,
        id_prefix: format!(
            "lo{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis()
        ),
        other_app_names,
    };
    let (leafs, publishers) = matching_names(hint_name, snapshot, package_id);
    let install_location = vetted_install_location(snapshot);

    // The location the app told Windows it installed to, if it survived and is
    // somewhere we are willing to touch.
    if let Some(loc) = &install_location {
        let admin = folder_roots()
            .iter()
            .any(|(root, admin)| *admin && norm(loc).starts_with(&format!("{}\\", norm(root))));
        ctx.push(
            Target::Dir(loc.clone()),
            Reason::InstallLocation,
            Confidence::High,
            admin,
        );
    }

    // A dangling Add/Remove Programs entry (broken uninstallers leave these).
    if let Some((hive, key_path)) = &snapshot.uninstall_key {
        if reg_key_exists(*hive, key_path) && is_safe_reg_subkey(key_path) {
            ctx.push(
                Target::RegKey {
                    hive: *hive,
                    path: key_path.clone(),
                },
                Reason::ArpLeftover,
                Confidence::High,
                *hive == Hive::Hklm,
            );
        }
    }

    scan_folders(&mut ctx, &leafs, &publishers);
    scan_registry(&mut ctx, &leafs, &publishers);
    scan_run_keys(&mut ctx, &leafs, install_location.as_deref());
    scan_shortcuts(&mut ctx, &leafs);

    ctx.items
}

// ---------------------------------------------------------------------------
// Clean
// ---------------------------------------------------------------------------

fn backup_dir_for(package_id: &str) -> PathBuf {
    // Milliseconds, not seconds: retrying the failed half of a clean lands in
    // the same second and would otherwise overwrite the first run's `.reg`
    // files, destroying the only copy of what was already deleted.
    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let safe: String = package_id
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '.' || c == '-' {
                c
            } else {
                '_'
            }
        })
        .collect();
    crate::logging::log_dir()
        .parent()
        .map(|p| p.to_path_buf())
        .unwrap_or_else(std::env::temp_dir)
        .join("backups")
        .join(format!("{safe}-{ts}"))
}

/// A publisher folder offered whole must still hold exactly one entry when the
/// user finally confirms — dialogs can sit open for the whole session TTL.
fn still_single_child(path: &Path) -> bool {
    match std::fs::read_dir(path) {
        Ok(entries) => entries.flatten().count() <= 1,
        Err(_) => false,
    }
}

fn reg_key_still_single_child(hive: Hive, path: &str) -> bool {
    match hive.key().open_subkey_with_flags(path, KEY_READ) {
        Ok(key) => key.enum_keys().flatten().count() <= 1 && key.enum_values().next().is_none(),
        Err(_) => false,
    }
}

fn export_reg_key(hive: Hive, path: &str, backup_dir: &Path, index: usize) -> Result<(), String> {
    std::fs::create_dir_all(backup_dir).map_err(|e| e.to_string())?;
    let file = backup_dir.join(format!("{index:03}.reg"));
    let full = format!("{}\\{}", hive.reg_exe_name(), path);

    let mut cmd = std::process::Command::new("reg");
    cmd.args(["export", &full])
        .arg(&file)
        .arg("/y")
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000);
    }
    let status = cmd.status().map_err(|e| e.to_string())?;
    if !status.success() {
        return Err(format!("reg export failed for {full}"));
    }
    Ok(())
}

fn delete_reg_key(hive: Hive, path: &str) -> Result<(), std::io::Error> {
    use winreg::enums::KEY_ALL_ACCESS;
    let (parent, child) = match path.rsplit_once('\\') {
        Some(split) => split,
        None => return Err(std::io::Error::other("refusing to delete a root key")),
    };
    let parent_key = hive.key().open_subkey_with_flags(parent, KEY_ALL_ACCESS)?;
    parent_key.delete_subkey_all(child)
}

fn delete_reg_value(hive: Hive, key_path: &str, value: &str) -> Result<(), std::io::Error> {
    use winreg::enums::KEY_ALL_ACCESS;
    let key = hive
        .key()
        .open_subkey_with_flags(key_path, KEY_ALL_ACCESS)?;
    key.delete_value(value)
}

fn is_access_denied(err: &std::io::Error) -> bool {
    err.kind() == std::io::ErrorKind::PermissionDenied || err.raw_os_error() == Some(5)
}

/// Delete the approved items. Guards are re-checked here — the ids came back
/// from the UI, but the paths never left this process.
pub fn clean(package_id: &str, items: &[Leftover], elevated: bool) -> CleanResultDto {
    let backup_dir = backup_dir_for(package_id);
    let mut used_backup = false;
    let mut results = Vec::with_capacity(items.len());

    for (index, item) in items.iter().enumerate() {
        let outcome: Result<(), (String, bool)> = match &item.target {
            Target::Dir(path) | Target::Shortcut(path) => {
                if is_protected_path(path) {
                    Err(("refused: protected path".into(), false))
                } else if item.reason == Reason::PublisherOnly && !still_single_child(path) {
                    // Something else moved into the publisher folder between
                    // the scan and now; taking it whole would delete a product
                    // the user never agreed to remove.
                    Err((
                        "refused: the publisher folder is no longer empty".into(),
                        false,
                    ))
                } else if !path.exists() {
                    Ok(()) // Already gone counts as cleaned.
                } else {
                    trash::delete(path).map_err(|e| {
                        let needs_admin = item.requires_admin && !elevated;
                        (e.to_string(), needs_admin)
                    })
                }
            }
            Target::RegKey { hive, path } => {
                if !is_safe_reg_subkey(path) {
                    Err(("refused: protected registry key".into(), false))
                } else if item.reason == Reason::PublisherOnly
                    && !reg_key_still_single_child(*hive, path)
                {
                    Err((
                        "refused: the publisher key is no longer empty".into(),
                        false,
                    ))
                } else if !reg_key_exists(*hive, path) {
                    Ok(())
                } else {
                    match export_reg_key(*hive, path, &backup_dir, index) {
                        Err(e) => Err((format!("backup failed, key kept: {e}"), false)),
                        Ok(()) => {
                            used_backup = true;
                            delete_reg_key(*hive, path)
                                .map_err(|e| (e.to_string(), is_access_denied(&e)))
                        }
                    }
                }
            }
            Target::RegValue { hive, key, value } => {
                match export_reg_key(*hive, key, &backup_dir, index) {
                    Err(e) => Err((format!("backup failed, value kept: {e}"), false)),
                    Ok(()) => {
                        used_backup = true;
                        delete_reg_value(*hive, key, value)
                            .map_err(|e| (e.to_string(), is_access_denied(&e)))
                    }
                }
            }
        };

        match outcome {
            Ok(()) => {
                tracing::info!(item = %item.id, "leftover removed");
                results.push(CleanItemResultDto {
                    id: item.id.clone(),
                    ok: true,
                    needs_admin: false,
                    error: None,
                });
            }
            Err((message, needs_admin)) => {
                tracing::warn!(item = %item.id, error = %message, "leftover removal failed");
                results.push(CleanItemResultDto {
                    id: item.id.clone(),
                    ok: false,
                    needs_admin,
                    error: Some(message),
                });
            }
        }
    }

    CleanResultDto {
        results,
        backup_dir: used_backup.then(|| backup_dir.display().to_string()),
    }
}

// ---------------------------------------------------------------------------
// Session store
// ---------------------------------------------------------------------------

impl CleanupStore {
    fn purge_expired(sessions: &mut HashMap<String, Session>) {
        sessions.retain(|_, s| s.created.elapsed() < SESSION_TTL);
    }

    pub fn prepare(&self, package_id: &str, hint_name: &str) {
        let snapshot = capture_snapshot(hint_name);
        let Ok(mut sessions) = self.sessions.lock() else {
            return;
        };
        Self::purge_expired(&mut sessions);
        sessions.insert(
            package_id.to_string(),
            Session {
                snapshot,
                hint_name: hint_name.to_string(),
                items: Vec::new(),
                created: Instant::now(),
            },
        );
    }

    pub fn scan(&self, package_id: &str) -> ScanResultDto {
        let (snapshot, hint_name) = {
            let Ok(mut sessions) = self.sessions.lock() else {
                return ScanResultDto {
                    items: Vec::new(),
                    elevated: is_elevated(),
                };
            };
            Self::purge_expired(&mut sessions);
            match sessions.get(package_id) {
                Some(s) => (s.snapshot.clone(), s.hint_name.clone()),
                // No prepare happened (e.g. app restarted); scan on the id alone.
                None => (
                    ArpSnapshot::default(),
                    package_id
                        .rsplit('.')
                        .next()
                        .unwrap_or(package_id)
                        .to_string(),
                ),
            }
        };

        let items = scan(package_id, &hint_name, &snapshot);
        let dtos: Vec<LeftoverDto> = items.iter().map(to_dto).collect();

        if let Ok(mut sessions) = self.sessions.lock() {
            let entry = sessions
                .entry(package_id.to_string())
                .or_insert_with(|| Session {
                    snapshot,
                    hint_name,
                    items: Vec::new(),
                    created: Instant::now(),
                });
            entry.items = items;
            entry.created = Instant::now();
        }

        ScanResultDto {
            items: dtos,
            elevated: is_elevated(),
        }
    }

    pub fn clean(&self, package_id: &str, item_ids: &[String]) -> CleanResultDto {
        let selected: Vec<Leftover> = {
            let Ok(sessions) = self.sessions.lock() else {
                return Self::all_failed(item_ids, "the cleanup session is unavailable");
            };
            match sessions.get(package_id) {
                Some(session) => session
                    .items
                    .iter()
                    .filter(|item| item_ids.contains(&item.id))
                    .cloned()
                    .collect(),
                None => Vec::new(),
            }
        };

        // An id the session no longer knows must be reported, not silently
        // dropped: returning an empty success would make the dialog claim
        // everything was removed when nothing was.
        if selected.len() != item_ids.len() {
            let found: Vec<&str> = selected.iter().map(|i| i.id.as_str()).collect();
            let missing: Vec<String> = item_ids
                .iter()
                .filter(|id| !found.contains(&id.as_str()))
                .cloned()
                .collect();
            tracing::warn!(
                package = %package_id,
                missing = missing.len(),
                "cleanup ids are no longer in the session; rescan required"
            );
            let mut result = clean(package_id, &selected, is_elevated());
            result
                .results
                .extend(missing.into_iter().map(|id| CleanItemResultDto {
                    id,
                    ok: false,
                    needs_admin: false,
                    error: Some("this scan expired; run the uninstall check again".into()),
                }));
            return result;
        }

        clean(package_id, &selected, is_elevated())
    }

    fn all_failed(item_ids: &[String], message: &str) -> CleanResultDto {
        CleanResultDto {
            results: item_ids
                .iter()
                .map(|id| CleanItemResultDto {
                    id: id.clone(),
                    ok: false,
                    needs_admin: false,
                    error: Some(message.to_string()),
                })
                .collect(),
            backup_dir: None,
        }
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sanitizes_versions_and_arch() {
        assert_eq!(sanitize_name("7-Zip 23.01 (x64)"), "7-Zip");
        assert_eq!(sanitize_name("Visual Studio Code"), "Visual Studio Code");
        assert_eq!(sanitize_name("Foo v1.2.3"), "Foo");
        assert_eq!(sanitize_name("Bar 64-bit"), "Bar");
        assert_eq!(sanitize_name("App™ 2.0"), "App");
        assert_eq!(sanitize_name("OBS Studio 30.1.2"), "OBS Studio");
    }

    #[test]
    fn deny_list_blocks_dangerous_names() {
        assert!(is_deny_listed("Microsoft"));
        assert!(is_deny_listed("windows"));
        assert!(is_deny_listed("ab"));
        assert!(is_deny_listed(""));
        assert!(is_deny_listed("Google"));
        assert!(!is_deny_listed("7-Zip"));
        assert!(!is_deny_listed("Chrome"));
    }

    #[test]
    fn protects_roots_and_shallow_paths() {
        assert!(is_protected_path(Path::new("C:\\")));
        assert!(is_protected_path(Path::new("C:")));
        if let Ok(windir) = std::env::var("WINDIR") {
            assert!(is_protected_path(Path::new(&windir)));
            assert!(is_protected_path(&Path::new(&windir).join("System32")));
        }
        if let Ok(lad) = std::env::var("LOCALAPPDATA") {
            assert!(is_protected_path(Path::new(&lad)));
            assert!(is_protected_path(&Path::new(&lad).join("Wingman")));
            assert!(is_protected_path(
                &Path::new(&lad).join("Wingman").join("logs")
            ));
            assert!(!is_protected_path(&Path::new(&lad).join("SomeRandomApp")));
        }
        if let Ok(profile) = std::env::var("USERPROFILE") {
            assert!(is_protected_path(Path::new(&profile)));
        }
        // Leaf too short to be a trustworthy match.
        assert!(is_protected_path(Path::new("C:\\Data\\ab")));
    }

    #[test]
    fn reg_guards_hold() {
        assert!(is_safe_reg_subkey("Software\\SomeVendor\\SomeApp"));
        assert!(is_safe_reg_subkey("Software\\SomeApp"));
        assert!(is_safe_reg_subkey("SOFTWARE\\WOW6432Node\\Vendor\\MyTool"));
        // "App" alone is deny-listed even under a vendor: too generic to trust.
        assert!(!is_safe_reg_subkey("SOFTWARE\\WOW6432Node\\Vendor\\App"));
        assert!(!is_safe_reg_subkey("Software"));
        assert!(!is_safe_reg_subkey("Software\\Microsoft"));
        assert!(!is_safe_reg_subkey("Software\\Microsoft\\Windows"));
        assert!(!is_safe_reg_subkey(
            "Software\\Microsoft\\Windows\\CurrentVersion\\Run"
        ));
        assert!(!is_safe_reg_subkey("System\\CurrentControlSet"));
        // The sanctioned exception: dangling ARP entries.
        assert!(is_safe_reg_subkey(
            "SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\SomeApp"
        ));
        // Deny-listed leaves cannot be targeted directly.
        assert!(!is_safe_reg_subkey("Software\\Classes"));
        assert!(!is_safe_reg_subkey("Software\\Vendor\\Windows"));
    }

    #[test]
    fn extracts_exe_from_run_commands() {
        assert_eq!(
            extract_exe("\"C:\\Apps\\Foo\\foo.exe\" --tray"),
            Some(PathBuf::from("C:\\Apps\\Foo\\foo.exe"))
        );
        assert_eq!(
            extract_exe("C:\\Apps\\foo.exe --tray"),
            Some(PathBuf::from("C:\\Apps\\foo.exe"))
        );
        assert_eq!(extract_exe(""), None);
    }

    #[test]
    fn expands_env_vars() {
        std::env::set_var("WINGMAN_TEST_VAR", "C:\\Test");
        assert_eq!(
            expand_env("%WINGMAN_TEST_VAR%\\app.exe"),
            "C:\\Test\\app.exe"
        );
        assert_eq!(expand_env("%UNSET_VAR_XYZ%\\x"), "%UNSET_VAR_XYZ%\\x");
        assert_eq!(expand_env("plain"), "plain");
    }

    #[test]
    fn arp_matching_prefers_exact_then_sanitized() {
        let entries = vec![
            ArpEntry {
                hive: Hive::Hkcu,
                key_path: "a".into(),
                display_name: "7-Zip 23.01 (x64)".into(),
                publisher: Some("Igor Pavlov".into()),
                install_location: None,
            },
            ArpEntry {
                hive: Hive::Hkcu,
                key_path: "b".into(),
                display_name: "7-Zip".into(),
                publisher: None,
                install_location: None,
            },
        ];
        let hit = best_arp_match(&entries, "7-Zip").expect("should match");
        assert_eq!(hit.key_path, "b");

        let only_versioned = &entries[..1];
        let hit = best_arp_match(only_versioned, "7-Zip").expect("sanitized should match");
        assert_eq!(hit.key_path, "a");

        assert!(best_arp_match(&entries, "zz").is_none());
        assert!(best_arp_match(&entries, "Nonexistent App").is_none());
    }

    #[test]
    fn matching_names_filters_junk() {
        let snapshot = ArpSnapshot {
            display_name: Some("7-Zip 23.01 (x64)".into()),
            publisher: Some("Igor Pavlov".into()),
            ..Default::default()
        };
        let (leafs, publishers) = matching_names("7-Zip", &snapshot, "7zip.7zip");
        assert!(leafs.iter().any(|l| l == "7-Zip"));
        assert!(leafs.iter().any(|l| l == "7zip"));
        assert!(publishers.iter().any(|p| p == "Igor Pavlov"));
        // Deny-listed and path-like values never become candidates.
        let (leafs, _) = matching_names("Microsoft", &ArpSnapshot::default(), "x.y");
        assert!(!leafs.iter().any(|l| l.eq_ignore_ascii_case("microsoft")));
        let (leafs, _) = matching_names("C:\\Evil", &ArpSnapshot::default(), "a.b");
        assert!(!leafs.iter().any(|l| l.contains('\\')));
    }

    #[test]
    fn clean_refuses_protected_targets_even_if_session_has_them() {
        // Defense in depth: even a forged session item cannot escape the guards.
        let items = vec![
            Leftover {
                id: "lo-0".into(),
                target: Target::Dir(PathBuf::from("C:\\")),
                size_bytes: None,
                reason: Reason::NameMatch,
                confidence: Confidence::High,
                requires_admin: false,
            },
            Leftover {
                id: "lo-1".into(),
                target: Target::RegKey {
                    hive: Hive::Hkcu,
                    path: "Software\\Microsoft".into(),
                },
                size_bytes: None,
                reason: Reason::NameMatch,
                confidence: Confidence::High,
                requires_admin: false,
            },
        ];
        let result = clean("test.pkg", &items, false);
        assert_eq!(result.results.len(), 2);
        for r in &result.results {
            assert!(!r.ok);
            assert!(r.error.as_deref().unwrap_or_default().contains("refused"));
        }
        assert!(result.backup_dir.is_none());
    }

    #[test]
    fn store_scan_without_prepare_does_not_panic() {
        let store = CleanupStore::default();
        let result = store.scan("Definitely.NotInstalledXyz");
        // No prepare, no matching app: the scan may find nothing, but it must
        // return cleanly.
        let _ = result.items;
    }

    #[test]
    fn clean_reports_ids_the_session_no_longer_knows() {
        // A silent empty success would make the dialog claim it removed
        // everything while nothing happened.
        let store = CleanupStore::default();
        let result = store.clean("nothing.here", &["lo-99".into()]);
        assert_eq!(result.results.len(), 1);
        assert!(!result.results[0].ok);
        assert!(result.results[0].error.is_some());
        assert!(result.backup_dir.is_none());
    }

    #[test]
    fn norm_canonicalises_separators_and_trailing_junk() {
        // Windows treats all of these as the same directory, so the guards
        // must too.
        let expected = norm(Path::new("C:\\Program Files"));
        for variant in [
            "C:/Program Files",
            "C:\\Program Files\\",
            "C:\\Program Files.",
            "C:\\Program Files ",
            "c:/program files/",
            "C:\\\\Program Files",
        ] {
            assert_eq!(norm(Path::new(variant)), expected, "variant: {variant}");
        }
    }

    #[test]
    fn protects_roots_reached_through_alternative_spellings() {
        // The bug this pins: a forward-slash InstallLocation used to slip past
        // every prefix comparison and offer the whole directory for deletion.
        if std::env::var("ProgramFiles").is_ok() {
            assert!(is_protected_path(Path::new("C:/Program Files")));
            assert!(is_protected_path(Path::new("C:\\Program Files\\")));
            assert!(is_protected_path(Path::new("C:\\Program Files.")));
        }
        if let Ok(windir) = std::env::var("WINDIR") {
            let alt = windir.replace('\\', "/");
            assert!(is_protected_path(&Path::new(&alt).join("System32")));
        }
    }

    #[test]
    fn protects_generic_and_shared_leaf_names() {
        // An InstallLocation pointing at a shared or personal folder must
        // never be offered, even though none of these are env roots.
        for path in [
            "C:\\Program Files\\Common Files",
            "C:\\ProgramData\\Microsoft",
            "D:\\SteamLibrary\\steamapps\\common",
            "D:\\Games",
            "C:\\Apps\\bin",
            "C:\\Stuff\\Downloads",
        ] {
            assert!(is_protected_path(Path::new(path)), "should protect {path}");
        }
        if let Ok(profile) = std::env::var("USERPROFILE") {
            for folder in ["Documents", "Downloads", "Desktop", "OneDrive"] {
                assert!(
                    is_protected_path(&Path::new(&profile).join(folder)),
                    "should protect {folder}"
                );
            }
        }
        // A real application folder still passes.
        assert!(!is_protected_path(Path::new(
            "C:\\Program Files\\FooEditor"
        )));
    }

    #[test]
    fn shallow_paths_are_refused() {
        assert!(is_protected_path(Path::new("C:\\Foo\\..")));
        assert!(is_protected_path(Path::new("D:\\")));
        assert!(!is_protected_path(Path::new("D:\\FooEditor")));
    }

    #[test]
    fn arp_matching_requires_a_word_boundary() {
        let entries = vec![
            ArpEntry {
                hive: Hive::Hkcu,
                key_path: "github".into(),
                display_name: "GitHub Desktop".into(),
                publisher: None,
                install_location: Some("C:\\Users\\me\\AppData\\Local\\GitHubDesktop".into()),
            },
            ArpEntry {
                hive: Hive::Hkcu,
                key_path: "acrobat".into(),
                display_name: "Adobe Acrobat Reader".into(),
                publisher: None,
                install_location: None,
            },
        ];
        // "Git" must not select GitHub Desktop, and "Reader" must not select
        // Acrobat: either would hand another product's folder to the cleaner.
        assert!(best_arp_match(&entries, "Git").is_none());
        assert!(best_arp_match(&entries, "Reader").is_none());

        let versioned = vec![ArpEntry {
            hive: Hive::Hkcu,
            key_path: "git".into(),
            display_name: "Git version 2.40.1".into(),
            publisher: None,
            install_location: None,
        }];
        assert!(best_arp_match(&versioned, "Git").is_some());
    }

    #[test]
    fn word_boundary_helper() {
        assert!(starts_with_word("git version 2.40", "git"));
        assert!(starts_with_word("git", "git"));
        assert!(starts_with_word("git-lfs", "git"));
        assert!(!starts_with_word("github desktop", "git"));
        assert!(!starts_with_word("gitkraken", "git"));
    }

    #[test]
    fn install_location_must_survive_vetting() {
        let bad = ArpSnapshot {
            install_location: Some(PathBuf::from("C:/Program Files")),
            ..Default::default()
        };
        assert!(vetted_install_location(&bad).is_none());

        let missing = ArpSnapshot {
            install_location: Some(PathBuf::from("C:\\Definitely\\Not\\There\\XyzQqq")),
            ..Default::default()
        };
        assert!(vetted_install_location(&missing).is_none());

        assert!(vetted_install_location(&ArpSnapshot::default()).is_none());
    }

    #[test]
    fn publishers_keep_deny_listed_vendors_as_parents() {
        let snapshot = ArpSnapshot {
            publisher: Some("Google LLC".into()),
            ..Default::default()
        };
        let (_, publishers) = matching_names("Chrome", &snapshot, "Google.Chrome");
        // "Google" has to reach the scanner as a *parent* so `…\Google\Chrome`
        // can be found; the deny-list is what stops `…\Google` being offered.
        assert!(publishers.iter().any(|p| p.eq_ignore_ascii_case("Google")));
        assert!(is_deny_listed("Google"));
    }

    #[test]
    fn scan_ids_are_unique_across_runs() {
        let snapshot = ArpSnapshot::default();
        let first = scan("Foo.Bar", "NoSuchAppXyzQqq", &snapshot);
        let second = scan("Foo.Bar", "NoSuchAppXyzQqq", &snapshot);
        for a in &first {
            for b in &second {
                assert_ne!(a.id, b.id, "ids must not repeat between scans");
            }
        }
    }
}
