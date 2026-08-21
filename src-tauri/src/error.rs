use serde::Serialize;
use thiserror::Error;

/// Exit codes emitted by winget that we can act on.
/// Reference: APPINSTALLER_CLI_ERROR_* in the winget source.
pub mod exit_code {
    pub const NO_APPLICABLE_INSTALLER: i32 = 0x8A15002Bu32 as i32;
    pub const NO_PACKAGES_FOUND: i32 = 0x8A150014u32 as i32;
    pub const ADMIN_REQUIRED: i32 = 0x8A150019u32 as i32;
    pub const SOURCE_IN_USE: i32 = 0x8A150049u32 as i32;
    pub const INSTALL_ALREADY_RUNNING: i32 = 0x8A150034u32 as i32;
    pub const DOWNLOAD_FAILED: i32 = 0x8A150044u32 as i32;
    pub const INSTALLER_HASH_MISMATCH: i32 = 0x8A150011u32 as i32;
    pub const UPDATE_NOT_APPLICABLE: i32 = 0x8A150039u32 as i32;
    pub const CANCELLED: i32 = 0x8A150023u32 as i32;
}

/// Actionable error surface. Each variant maps to a distinct UI affordance,
/// so the frontend can offer the right recovery instead of dumping raw text.
#[derive(Debug, Error, Serialize, Clone)]
#[serde(tag = "kind", content = "detail")]
pub enum WingetError {
    #[error("winget is not installed or not on PATH")]
    NotInstalled,

    #[error("winget {found} is older than the minimum supported {minimum}")]
    Unsupported { found: String, minimum: String },

    #[error("no packages matched the query")]
    NotFound,

    #[error("this operation requires administrator privileges")]
    NeedsElevation,

    #[error("the package source is busy; another winget operation may be running")]
    SourceBusy,

    #[error("network failure while talking to the package source")]
    Network(String),

    #[error("the downloaded installer failed hash verification")]
    HashMismatch,

    #[error("no applicable installer for this system")]
    NoApplicableInstaller,

    #[error("no update available for this package")]
    NoUpdateAvailable,

    #[error("the operation was cancelled")]
    Cancelled,

    #[error("the operation timed out after {0} seconds")]
    Timeout(u64),

    #[error("invalid package identifier: {0}")]
    InvalidId(String),

    #[error("winget exited with code {code:#X}: {message}")]
    CommandFailed { code: i32, message: String },

    #[error("io error: {0}")]
    Io(String),
}

impl From<std::io::Error> for WingetError {
    fn from(e: std::io::Error) -> Self {
        if e.kind() == std::io::ErrorKind::NotFound {
            WingetError::NotInstalled
        } else {
            WingetError::Io(e.to_string())
        }
    }
}

impl WingetError {
    /// Map a winget process exit code (plus whatever it wrote to stderr) onto a
    /// variant the UI knows how to present.
    pub fn from_exit(code: Option<i32>, stderr: &str) -> Self {
        let lower = stderr.to_lowercase();
        match code {
            Some(exit_code::ADMIN_REQUIRED) => WingetError::NeedsElevation,
            Some(exit_code::NO_PACKAGES_FOUND) => WingetError::NotFound,
            Some(exit_code::SOURCE_IN_USE) | Some(exit_code::INSTALL_ALREADY_RUNNING) => {
                WingetError::SourceBusy
            }
            Some(exit_code::DOWNLOAD_FAILED) => WingetError::Network(stderr.trim().to_string()),
            Some(exit_code::INSTALLER_HASH_MISMATCH) => WingetError::HashMismatch,
            Some(exit_code::NO_APPLICABLE_INSTALLER) => WingetError::NoApplicableInstaller,
            Some(exit_code::UPDATE_NOT_APPLICABLE) => WingetError::NoUpdateAvailable,
            Some(exit_code::CANCELLED) => WingetError::Cancelled,
            other => {
                // Exit codes are not always populated (or are generic), so fall
                // back to sniffing the message for the cases users hit most.
                if lower.contains("administrator") || lower.contains("elevat") {
                    WingetError::NeedsElevation
                } else if lower.contains("no package found")
                    || lower.contains("no installed package")
                {
                    WingetError::NotFound
                } else if lower.contains("another installation")
                    || lower.contains("currently in use")
                {
                    WingetError::SourceBusy
                } else if lower.contains("network")
                    || lower.contains("internet")
                    || lower.contains("could not be resolved")
                {
                    WingetError::Network(stderr.trim().to_string())
                } else {
                    WingetError::CommandFailed {
                        code: other.unwrap_or(-1),
                        message: stderr.trim().to_string(),
                    }
                }
            }
        }
    }

    /// Whether retrying the same command has a realistic chance of succeeding.
    pub fn is_retryable(&self) -> bool {
        matches!(
            self,
            WingetError::SourceBusy | WingetError::Network(_) | WingetError::Timeout(_)
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_admin_exit_code() {
        assert!(matches!(
            WingetError::from_exit(Some(exit_code::ADMIN_REQUIRED), ""),
            WingetError::NeedsElevation
        ));
    }

    #[test]
    fn sniffs_admin_from_stderr_without_exit_code() {
        assert!(matches!(
            WingetError::from_exit(None, "Access denied. Run as administrator."),
            WingetError::NeedsElevation
        ));
    }

    #[test]
    fn source_busy_is_retryable() {
        assert!(WingetError::SourceBusy.is_retryable());
        assert!(!WingetError::NeedsElevation.is_retryable());
    }

    #[test]
    fn unknown_code_falls_through_to_command_failed() {
        let e = WingetError::from_exit(Some(42), "something odd");
        match e {
            WingetError::CommandFailed { code, message } => {
                assert_eq!(code, 42);
                assert_eq!(message, "something odd");
            }
            other => panic!("expected CommandFailed, got {other:?}"),
        }
    }
}
