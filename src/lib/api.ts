import { invoke } from "@tauri-apps/api/core";
import type { Package, PackageDetails, StartupInfo } from "./types";

/**
 * The single bridge to Rust. Everything the UI can ask winget to do goes
 * through one of these calls — there is no shell access from the frontend.
 */
export const api = {
  checkWinget: () => invoke<StartupInfo>("check_winget"),
  search: (query: string, source?: string) =>
    invoke<Package[]>("search", { query, source: source ?? null }),
  listInstalled: () => invoke<Package[]>("list_installed"),
  listUpgradable: () => invoke<Package[]>("list_upgradable"),
  show: (id: string) => invoke<PackageDetails>("show", { id }),
  install: (id: string, version?: string) =>
    invoke<void>("install", { id, version: version ?? null }),
  uninstall: (id: string) => invoke<void>("uninstall", { id }),
  upgrade: (id: string) => invoke<void>("upgrade", { id }),
  upgradeAll: () => invoke<void>("upgrade_all"),
  cancel: (id: string) => invoke<boolean>("cancel", { id }),
  exportList: (path: string) => invoke<void>("export_list", { path }),
  importList: (path: string) => invoke<void>("import_list", { path }),
  relaunchElevated: () => invoke<void>("relaunch_elevated"),
  openLogDir: () => invoke<void>("open_log_dir"),
  openUrl: (url: string) => invoke<void>("open_url", { url }),
};
