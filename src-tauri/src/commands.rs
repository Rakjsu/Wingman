use crate::winget::{self, Package, WingetError};
use serde::Serialize;
use tauri::{AppHandle, Emitter};

#[derive(Serialize, Clone)]
pub struct ProgressEvent {
    pub id: String,
    pub action: String,
    pub line: String,
}

#[derive(Serialize, Clone)]
pub struct DoneEvent {
    pub id: String,
    pub action: String,
    pub ok: bool,
    pub error: Option<String>,
}

#[tauri::command]
pub async fn search(query: String) -> Result<Vec<Package>, WingetError> {
    winget::search(&query).await
}

#[tauri::command]
pub async fn list_installed() -> Result<Vec<Package>, WingetError> {
    winget::list_installed().await
}

#[tauri::command]
pub async fn list_upgradable() -> Result<Vec<Package>, WingetError> {
    winget::list_upgradable().await
}

async fn perform(app: AppHandle, action: &'static str, id: String) -> Result<(), WingetError> {
    let id_for_event = id.clone();
    let app_for_event = app.clone();
    let emit_id = id.clone();
    let result = winget::run_action(action, &id, move |line| {
        let _ = app_for_event.emit(
            "winget-progress",
            ProgressEvent {
                id: emit_id.clone(),
                action: action.to_string(),
                line,
            },
        );
    })
    .await;
    let done = DoneEvent {
        id: id_for_event,
        action: action.to_string(),
        ok: result.is_ok(),
        error: result.as_ref().err().map(|e| e.to_string()),
    };
    let _ = app.emit("winget-done", done);
    result
}

#[tauri::command]
pub async fn install(app: AppHandle, id: String) -> Result<(), WingetError> {
    perform(app, "install", id).await
}

#[tauri::command]
pub async fn uninstall(app: AppHandle, id: String) -> Result<(), WingetError> {
    perform(app, "uninstall", id).await
}

#[tauri::command]
pub async fn upgrade(app: AppHandle, id: String) -> Result<(), WingetError> {
    perform(app, "upgrade", id).await
}

#[tauri::command]
pub async fn upgrade_all(app: AppHandle) -> Result<(), WingetError> {
    let app_for_event = app.clone();
    let result = winget::upgrade_all(move |line| {
        let _ = app_for_event.emit(
            "winget-progress",
            ProgressEvent {
                id: "*".into(),
                action: "upgrade-all".into(),
                line,
            },
        );
    })
    .await;
    let _ = app.emit(
        "winget-done",
        DoneEvent {
            id: "*".into(),
            action: "upgrade-all".into(),
            ok: result.is_ok(),
            error: result.as_ref().err().map(|e| e.to_string()),
        },
    );
    result
}
