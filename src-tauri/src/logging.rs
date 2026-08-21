use std::path::PathBuf;
use tracing_subscriber::layer::SubscriberExt;
use tracing_subscriber::util::SubscriberInitExt;
use tracing_subscriber::EnvFilter;

/// `%LOCALAPPDATA%\Wingman\logs` on Windows, a local fallback elsewhere.
pub fn log_dir() -> PathBuf {
    let base = std::env::var_os("LOCALAPPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(std::env::temp_dir);
    base.join("Wingman").join("logs")
}

/// Initialise tracing to both stdout (dev) and a daily-rotated file.
///
/// Returns the guard for the non-blocking writer; dropping it stops the
/// background flush thread, so the caller must keep it alive for the process
/// lifetime.
pub fn init() -> Option<tracing_appender::non_blocking::WorkerGuard> {
    let dir = log_dir();
    if let Err(e) = std::fs::create_dir_all(&dir) {
        eprintln!("wingman: could not create log dir {}: {e}", dir.display());
        return None;
    }

    let appender = tracing_appender::rolling::daily(&dir, "wingman.log");
    let (non_blocking, guard) = tracing_appender::non_blocking(appender);

    let filter = EnvFilter::try_from_env("WINGMAN_LOG")
        .unwrap_or_else(|_| EnvFilter::new("wingman=info,tauri=warn"));

    tracing_subscriber::registry()
        .with(filter)
        .with(
            tracing_subscriber::fmt::layer()
                .with_writer(non_blocking)
                .with_ansi(false),
        )
        .with(tracing_subscriber::fmt::layer().with_writer(std::io::stdout))
        .init();

    tracing::info!(version = env!("CARGO_PKG_VERSION"), "Wingman starting");
    purge_old_logs(&dir, MAX_LOG_AGE_DAYS);
    Some(guard)
}

/// Daily rotation alone grows without bound, so drop anything older than this.
const MAX_LOG_AGE_DAYS: u64 = 14;

fn purge_old_logs(dir: &std::path::Path, max_age_days: u64) {
    let max_age = std::time::Duration::from_secs(max_age_days * 24 * 60 * 60);
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        // Only ever touch files this app wrote.
        if !path
            .file_name()
            .and_then(|n| n.to_str())
            .is_some_and(|n| n.starts_with("wingman.log"))
        {
            continue;
        }
        let Ok(modified) = entry.metadata().and_then(|m| m.modified()) else {
            continue;
        };
        if modified.elapsed().is_ok_and(|age| age > max_age) {
            match std::fs::remove_file(&path) {
                Ok(()) => tracing::debug!(file = %path.display(), "purged old log"),
                Err(e) => tracing::warn!(file = %path.display(), error = %e, "could not purge log"),
            }
        }
    }
}
