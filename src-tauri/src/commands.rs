use crate::cleanup::{CleanResultDto, CleanupStore, ScanResultDto};
use crate::error::WingetError;
use crate::logging;
use crate::winget::{self, Backend, OpRegistry, Package, PackageDetails, SearchCache};
use serde::Serialize;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager, State};

#[derive(Default)]
pub struct AppState {
    pub registry: Arc<OpRegistry>,
    pub cache: Arc<SearchCache>,
    pub cleanup: Arc<CleanupStore>,
}

#[derive(Serialize, Clone)]
pub struct ProgressEvent {
    pub id: String,
    pub action: String,
    pub line: String,
    pub percent: Option<u8>,
    pub is_stderr: bool,
}

#[derive(Serialize, Clone)]
pub struct DoneEvent {
    pub id: String,
    pub action: String,
    pub ok: bool,
    pub error: Option<WingetError>,
}

#[derive(Serialize, Clone)]
pub struct StartupInfo {
    pub winget_version: Option<String>,
    pub error: Option<WingetError>,
    pub backend: Backend,
    pub app_version: String,
    pub log_dir: String,
}

// ---------------------------------------------------------------------------
// Read-only queries
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn check_winget() -> StartupInfo {
    let (winget_version, error) = match winget::check_available().await {
        Ok(v) => (Some(v), None),
        Err(e) => {
            tracing::error!(error = %e, "winget probe failed");
            (None, Some(e))
        }
    };
    StartupInfo {
        winget_version,
        error,
        backend: Backend::default(),
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        log_dir: logging::log_dir().display().to_string(),
    }
}

#[tauri::command]
pub async fn search(
    state: State<'_, AppState>,
    query: String,
    source: Option<String>,
) -> Result<Vec<Package>, WingetError> {
    let key = format!("{}|{}", source.as_deref().unwrap_or("*"), query.trim());
    if let Some(hit) = state.cache.get(&key) {
        tracing::debug!(query = %query, "search cache hit");
        return Ok(hit);
    }
    let result = winget::search(&query, source.as_deref()).await?;
    state.cache.put(key, result.clone());
    Ok(result)
}

#[tauri::command]
pub async fn list_installed() -> Result<Vec<Package>, WingetError> {
    winget::list_installed().await
}

#[tauri::command]
pub async fn list_upgradable() -> Result<Vec<Package>, WingetError> {
    winget::list_upgradable().await
}

#[tauri::command]
pub async fn show(id: String) -> Result<PackageDetails, WingetError> {
    winget::show(&id).await
}

// ---------------------------------------------------------------------------
// Mutating operations
// ---------------------------------------------------------------------------

async fn perform(
    app: AppHandle,
    registry: Arc<OpRegistry>,
    cache: Arc<SearchCache>,
    action: &'static str,
    op_id: String,
    args: Vec<String>,
) -> Result<(), WingetError> {
    tracing::info!(action, op_id = %op_id, "starting operation");
    let arg_refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();

    let emit_app = app.clone();
    let emit_id = op_id.clone();
    let result = winget::run_action(&registry, &op_id, arg_refs, move |progress| {
        let _ = emit_app.emit(
            "winget-progress",
            ProgressEvent {
                id: emit_id.clone(),
                action: action.to_string(),
                line: progress.line,
                percent: progress.percent,
                is_stderr: progress.is_stderr,
            },
        );
    })
    .await;

    match &result {
        Ok(()) => {
            tracing::info!(action, op_id = %op_id, "operation succeeded");
            cache.invalidate();
        }
        Err(e) => tracing::error!(action, op_id = %op_id, error = %e, "operation failed"),
    }

    let _ = app.emit(
        "winget-done",
        DoneEvent {
            id: op_id,
            action: action.to_string(),
            ok: result.is_ok(),
            error: result.as_ref().err().cloned(),
        },
    );
    result
}

#[tauri::command]
pub async fn install(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
    version: Option<String>,
) -> Result<(), WingetError> {
    winget::validate_id(&id)?;
    let registry = state.registry.clone();
    let cache = state.cache.clone();
    let args = winget::action_args("install", &id, version.as_deref())
        .into_iter()
        .map(String::from)
        .collect();
    perform(app, registry, cache, "install", id, args).await
}

#[tauri::command]
pub async fn uninstall(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<(), WingetError> {
    winget::validate_id(&id)?;
    let registry = state.registry.clone();
    let cache = state.cache.clone();
    let args = winget::action_args("uninstall", &id, None)
        .into_iter()
        .map(String::from)
        .collect();
    perform(app, registry, cache, "uninstall", id, args).await
}

#[tauri::command]
pub async fn upgrade(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<(), WingetError> {
    winget::validate_id(&id)?;
    let registry = state.registry.clone();
    let cache = state.cache.clone();
    let args = winget::action_args("upgrade", &id, None)
        .into_iter()
        .map(String::from)
        .collect();
    perform(app, registry, cache, "upgrade", id, args).await
}

#[tauri::command]
pub async fn upgrade_all(app: AppHandle, state: State<'_, AppState>) -> Result<(), WingetError> {
    let registry = state.registry.clone();
    let cache = state.cache.clone();
    let args = [
        "upgrade",
        "--all",
        "--silent",
        "--include-unknown",
        "--accept-package-agreements",
        "--accept-source-agreements",
        "--disable-interactivity",
    ]
    .into_iter()
    .map(String::from)
    .collect();
    perform(app, registry, cache, "upgrade-all", "*".to_string(), args).await
}

/// Async so `taskkill` never blocks the window: synchronous Tauri commands run
/// on the main thread.
#[tauri::command]
pub async fn cancel(state: State<'_, AppState>, id: String) -> Result<bool, WingetError> {
    tracing::info!(op_id = %id, "cancel requested");
    let registry = state.registry.clone();
    Ok(registry.cancel(&id).await)
}

// ---------------------------------------------------------------------------
// Import / export
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn export_list(path: String) -> Result<(), WingetError> {
    tracing::info!(path = %path, "exporting package list");
    winget::export_list(&path).await
}

#[tauri::command]
pub async fn import_list(
    app: AppHandle,
    state: State<'_, AppState>,
    path: String,
) -> Result<(), WingetError> {
    let registry = state.registry.clone();
    let cache = state.cache.clone();
    let args = [
        "import",
        "-i",
        &path,
        "--accept-package-agreements",
        "--accept-source-agreements",
        "--disable-interactivity",
        "--ignore-unavailable",
    ]
    .into_iter()
    .map(String::from)
    .collect();
    perform(app, registry, cache, "import", "*".to_string(), args).await
}

// ---------------------------------------------------------------------------
// Deep-clean uninstall
// ---------------------------------------------------------------------------

/// Capture the app's Add/Remove Programs data BEFORE the uninstall erases it.
/// `name` is a display hint from the UI; it only influences which leftovers
/// are *offered* — every deletion re-validates against the path guards, so a
/// bad hint can at worst surface an irrelevant candidate in the preview.
#[tauri::command]
pub async fn prepare_cleanup(
    state: State<'_, AppState>,
    id: String,
    name: String,
) -> Result<(), WingetError> {
    winget::validate_id(&id)?;
    let store = state.cleanup.clone();
    tokio::task::spawn_blocking(move || store.prepare(&id, &name))
        .await
        .map_err(|e| WingetError::Io(e.to_string()))?;
    Ok(())
}

/// Walk the well-known leftover locations for the just-uninstalled package.
/// Read-only: nothing is deleted here.
#[tauri::command]
pub async fn scan_leftovers(
    state: State<'_, AppState>,
    id: String,
) -> Result<ScanResultDto, WingetError> {
    winget::validate_id(&id)?;
    let store = state.cleanup.clone();
    tokio::task::spawn_blocking(move || store.scan(&id))
        .await
        .map_err(|e| WingetError::Io(e.to_string()))
}

/// Delete the leftovers the user approved. Accepts only opaque item ids from
/// the preceding scan — paths never round-trip through the frontend.
#[tauri::command]
pub async fn clean_leftovers(
    state: State<'_, AppState>,
    id: String,
    item_ids: Vec<String>,
) -> Result<CleanResultDto, WingetError> {
    winget::validate_id(&id)?;
    tracing::info!(package = %id, count = item_ids.len(), "cleaning leftovers");
    let store = state.cleanup.clone();
    tokio::task::spawn_blocking(move || store.clean(&id, &item_ids))
        .await
        .map_err(|e| WingetError::Io(e.to_string()))
}

// ---------------------------------------------------------------------------
// Shell integration
// ---------------------------------------------------------------------------

/// Relaunch Wingman elevated. Windows has no way to raise the privileges of a
/// live process, so this starts a new elevated instance and exits this one.
#[tauri::command]
pub async fn relaunch_elevated(app: AppHandle) -> Result<(), WingetError> {
    let exe = std::env::current_exe().map_err(|e| WingetError::Io(e.to_string()))?;
    let exe = exe.to_string_lossy().to_string();
    tracing::info!(exe = %exe, "relaunching elevated");

    // The path is bound as an argument instead of being interpolated into the
    // script body, so quotes inside it cannot alter the command. Async because
    // the UAC consent prompt blocks until the user answers.
    let status = tokio::process::Command::new("powershell")
        .args([
            "-NoProfile",
            "-WindowStyle",
            "Hidden",
            "-Command",
            "Start-Process -FilePath $args[0] -Verb RunAs",
            &exe,
        ])
        .status()
        .await
        .map_err(|e| WingetError::Io(e.to_string()))?;

    if !status.success() {
        // The user dismissed the UAC prompt; stay running and unelevated.
        return Err(WingetError::NeedsElevation);
    }
    app.exit(0);
    Ok(())
}

#[tauri::command]
pub fn open_log_dir(app: AppHandle) -> Result<(), WingetError> {
    let dir = logging::log_dir();
    tauri_plugin_opener::OpenerExt::opener(&app)
        .open_path(dir.display().to_string(), None::<&str>)
        .map_err(|e| WingetError::Io(e.to_string()))
}

#[tauri::command]
pub fn open_url(app: AppHandle, url: String) -> Result<(), WingetError> {
    // Only ever follow http(s) links that came from package metadata.
    if !url.starts_with("https://") && !url.starts_with("http://") {
        return Err(WingetError::InvalidQuery(
            "only http(s) URLs are allowed".into(),
        ));
    }
    tauri_plugin_opener::OpenerExt::opener(&app)
        .open_url(url, None::<&str>)
        .map_err(|e| WingetError::Io(e.to_string()))
}

#[tauri::command]
pub fn show_window(app: AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}
