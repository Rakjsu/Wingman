import { useCallback, useEffect, useMemo, useState } from "react";

/** Persisted state that tolerates a corrupt or unavailable storage backend. */
export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = window.localStorage.getItem(key);
      return raw === null ? initial : (JSON.parse(raw) as T);
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      // Private mode or a full quota. Keeping the in-memory value is enough to
      // stay usable, but say so rather than failing silently.
      console.warn(`wingman: could not persist "${key}"`, error);
    }
  }, [key, value]);

  return [value, setValue] as const;
}

/**
 * A persisted set of string ids.
 *
 * The Set is memoised on purpose: rebuilding it every render would give it a
 * new identity, which cascades into new `rowState` callbacks and defeats the
 * `memo` on every package row.
 */
export function useStringSet(key: string) {
  const [items, setItems] = useLocalStorage<string[]>(key, []);
  const set = useMemo(() => new Set(items), [items]);

  const toggle = useCallback(
    (id: string) => {
      setItems((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
      );
    },
    [setItems],
  );

  const clear = useCallback(() => setItems([]), [setItems]);

  return { set, items, toggle, clear, setItems };
}
