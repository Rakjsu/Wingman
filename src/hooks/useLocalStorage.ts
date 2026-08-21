import { useCallback, useEffect, useState } from "react";

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
    } catch {
      // Private mode or a full quota — keeping the in-memory value is enough.
    }
  }, [key, value]);

  return [value, setValue] as const;
}

/** A persisted set of string ids, with a toggle helper. */
export function useStringSet(key: string) {
  const [items, setItems] = useLocalStorage<string[]>(key, []);
  const set = new Set(items);

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
