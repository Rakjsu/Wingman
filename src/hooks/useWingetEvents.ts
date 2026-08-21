import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useEffect, useRef } from "react";
import type { DoneEvent, ProgressEvent } from "../lib/types";

/**
 * Subscribe to the backend's progress/completion events.
 *
 * `listen()` resolves *after* the effect body returns, so a naive cleanup that
 * only calls an `unlisten` captured in a local variable is still holding
 * `undefined` when React StrictMode tears the effect down on its extra dev
 * mount — the first subscription then leaks and every event arrives twice.
 * Tracking a `disposed` flag lets a late-resolving subscription unsubscribe
 * itself instead.
 */
export function useWingetEvents(
  onProgress: (event: ProgressEvent) => void,
  onDone: (event: DoneEvent) => void,
) {
  const progressRef = useRef(onProgress);
  const doneRef = useRef(onDone);
  progressRef.current = onProgress;
  doneRef.current = onDone;

  useEffect(() => {
    let disposed = false;
    const unlisteners: UnlistenFn[] = [];

    const track = (unlisten: UnlistenFn) => {
      if (disposed) unlisten();
      else unlisteners.push(unlisten);
    };

    void listen<ProgressEvent>("winget-progress", (e) =>
      progressRef.current(e.payload),
    ).then(track);
    void listen<DoneEvent>("winget-done", (e) => doneRef.current(e.payload)).then(track);

    return () => {
      disposed = true;
      for (const unlisten of unlisteners) unlisten();
      unlisteners.length = 0;
    };
  }, []);
}
