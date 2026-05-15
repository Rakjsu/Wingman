import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useEffect, useRef, useState } from "react";

export interface Package {
  name: string;
  id: string;
  version: string;
  available: string | null;
  source: string | null;
}

export interface ProgressEvent {
  id: string;
  action: string;
  line: string;
}

export interface DoneEvent {
  id: string;
  action: string;
  ok: boolean;
  error: string | null;
}

export const wingetApi = {
  search: (query: string) => invoke<Package[]>("search", { query }),
  listInstalled: () => invoke<Package[]>("list_installed"),
  listUpgradable: () => invoke<Package[]>("list_upgradable"),
  install: (id: string) => invoke<void>("install", { id }),
  uninstall: (id: string) => invoke<void>("uninstall", { id }),
  upgrade: (id: string) => invoke<void>("upgrade", { id }),
  upgradeAll: () => invoke<void>("upgrade_all"),
};

export function useWingetEvents(onProgress?: (e: ProgressEvent) => void, onDone?: (e: DoneEvent) => void) {
  const progressRef = useRef(onProgress);
  const doneRef = useRef(onDone);
  progressRef.current = onProgress;
  doneRef.current = onDone;
  useEffect(() => {
    let unlistenP: UnlistenFn | undefined;
    let unlistenD: UnlistenFn | undefined;
    listen<ProgressEvent>("winget-progress", (e) => progressRef.current?.(e.payload)).then(
      (fn) => (unlistenP = fn),
    );
    listen<DoneEvent>("winget-done", (e) => doneRef.current?.(e.payload)).then(
      (fn) => (unlistenD = fn),
    );
    return () => {
      unlistenP?.();
      unlistenD?.();
    };
  }, []);
}

export function useDebounced<T>(value: T, delay = 400): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}
