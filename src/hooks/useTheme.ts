import { useEffect } from "react";
import { useLocalStorage } from "./useLocalStorage";

export type ThemePreference = "light" | "dark" | "system";

/**
 * Applies the theme to `<html data-theme>` so CSS can switch on it.
 * "system" follows `prefers-color-scheme` live, without a reload.
 */
export function useTheme() {
  const [preference, setPreference] = useLocalStorage<ThemePreference>(
    "wingman.theme",
    "system",
  );

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    const apply = () => {
      const effective =
        preference === "system" ? (media.matches ? "dark" : "light") : preference;
      document.documentElement.dataset.theme = effective;
      document.documentElement.style.colorScheme = effective;
    };

    apply();
    if (preference !== "system") return;
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [preference]);

  return { preference, setPreference };
}
