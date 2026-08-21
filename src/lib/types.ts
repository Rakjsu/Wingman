export interface Package {
  name: string;
  id: string;
  version: string;
  available: string | null;
  source: string | null;
  matchedOn?: string | null;
  matched_on?: string | null;
}

export interface PackageDetails {
  id: string;
  name: string;
  publisher: string | null;
  version: string | null;
  description: string | null;
  homepage: string | null;
  license: string | null;
  versions: string[];
}

/** Mirrors the `#[serde(tag = "kind", content = "detail")]` enum in error.rs. */
export type WingetError =
  | { kind: "NotInstalled" }
  | { kind: "Unsupported"; detail: { found: string; minimum: string } }
  | { kind: "NotFound" }
  | { kind: "NeedsElevation" }
  | { kind: "SourceBusy" }
  | { kind: "Network"; detail: string }
  | { kind: "HashMismatch" }
  | { kind: "NoApplicableInstaller" }
  | { kind: "NoUpdateAvailable" }
  | { kind: "Cancelled" }
  | { kind: "Timeout"; detail: number }
  | { kind: "InvalidId"; detail: string }
  | { kind: "CommandFailed"; detail: { code: number; message: string } }
  | { kind: "Io"; detail: string };

export type WingetAction = "install" | "uninstall" | "upgrade" | "upgrade-all" | "import";

export interface ProgressEvent {
  id: string;
  action: WingetAction;
  line: string;
  percent: number | null;
  isStderr?: boolean;
  is_stderr?: boolean;
}

export interface DoneEvent {
  id: string;
  action: WingetAction;
  ok: boolean;
  error: WingetError | null;
}

export interface StartupInfo {
  wingetVersion?: string | null;
  winget_version?: string | null;
  error: WingetError | null;
  backend: string;
  appVersion?: string;
  app_version?: string;
  logDir?: string;
  log_dir?: string;
}

export interface HistoryEntry {
  id: string;
  action: WingetAction;
  ok: boolean;
  at: number;
  errorKind?: string;
}

export type SortKey = "name" | "id" | "source";
