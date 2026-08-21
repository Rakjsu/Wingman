import { useCallback, useEffect, useRef, useState } from "react";

export interface QueuedOperation {
  /** Package id, or "*" for whole-catalogue operations. */
  id: string;
  label: string;
  run: () => Promise<unknown>;
}

/**
 * Serialises winget operations.
 *
 * winget takes an exclusive lock on its package source, so firing several
 * installs at once makes them fail each other. Everything the user starts goes
 * through here and runs one at a time, in order.
 */
export function useOperationQueue(onStart: (op: QueuedOperation) => void) {
  const [pending, setPending] = useState<string[]>([]);
  const queue = useRef<QueuedOperation[]>([]);
  const active = useRef<string | null>(null);
  const disposed = useRef(false);
  const startRef = useRef(onStart);
  startRef.current = onStart;

  useEffect(() => {
    disposed.current = false;
    return () => {
      // Abandon anything still queued when the view goes away, so a stale
      // callback cannot fire against an unmounted tree.
      disposed.current = true;
      queue.current = [];
      active.current = null;
    };
  }, []);

  const pump = useCallback(() => {
    if (disposed.current || active.current !== null) return;
    const next = queue.current.shift();
    setPending(queue.current.map((op) => op.id));
    if (!next) return;

    active.current = next.id;
    startRef.current(next);
    // The queue advances from `complete`, driven by winget's own done event,
    // not from this promise — progress must stay on the row until winget says
    // it is finished.
    void next.run().catch(() => {
      active.current = null;
      pump();
    });
  }, []);

  /** Called when an operation reports completion. */
  const complete = useCallback(
    (id: string) => {
      if (active.current === id || active.current === null) {
        active.current = null;
        pump();
      }
    },
    [pump],
  );

  const enqueue = useCallback(
    (operations: QueuedOperation | QueuedOperation[]) => {
      const list = Array.isArray(operations) ? operations : [operations];
      const known = new Set([
        ...queue.current.map((op) => op.id),
        ...(active.current ? [active.current] : []),
      ]);
      // Clicking "Install" twice on the same row should not queue it twice.
      const fresh = list.filter((op) => !known.has(op.id));
      queue.current.push(...fresh);
      setPending(queue.current.map((op) => op.id));
      pump();
    },
    [pump],
  );

  const remove = useCallback((id: string) => {
    queue.current = queue.current.filter((op) => op.id !== id);
    setPending(queue.current.map((op) => op.id));
  }, []);

  const clear = useCallback(() => {
    queue.current = [];
    setPending([]);
  }, []);

  return { enqueue, complete, remove, clear, pending };
}
