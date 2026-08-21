import { t, type TKey } from "../i18n";
import type { WingetError } from "./types";

function isWingetError(value: unknown): value is WingetError {
  return (
    typeof value === "object" &&
    value !== null &&
    "kind" in value &&
    typeof (value as { kind: unknown }).kind === "string"
  );
}

/** Normalise anything a rejected `invoke` can throw into our error shape. */
export function toWingetError(value: unknown): WingetError {
  if (isWingetError(value)) return value;
  return { kind: "Io", detail: String(value) };
}

/** A short, human sentence for the error banner or toast. */
export function errorMessage(error: WingetError): string {
  const key = `error.${error.kind}` as TKey;
  const base = t(key);

  switch (error.kind) {
    case "Unsupported":
      return t("onboarding.outdated", {
        found: error.detail.found,
        minimum: error.detail.minimum,
      });
    case "CommandFailed":
      return error.detail.message ? `${base} ${error.detail.message}` : base;
    case "Network":
      return error.detail ? `${base} ${error.detail}` : base;
    case "InvalidId":
      return `${base} (${error.detail})`;
    default:
      return base;
  }
}

export const needsElevation = (e: WingetError) => e.kind === "NeedsElevation";
export const isCancellation = (e: WingetError) => e.kind === "Cancelled";
export const isRetryable = (e: WingetError) =>
  e.kind === "SourceBusy" || e.kind === "Network" || e.kind === "Timeout";
