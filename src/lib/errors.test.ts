import { describe, expect, it } from "vitest";
import { errorMessage, isRetryable, needsElevation, toWingetError } from "./errors";

describe("toWingetError", () => {
  it("passes through a structured backend error", () => {
    const error = { kind: "NeedsElevation" } as const;
    expect(toWingetError(error)).toEqual(error);
  });

  it("wraps anything unrecognised as an Io error", () => {
    expect(toWingetError("boom")).toEqual({ kind: "Io", detail: "boom" });
    expect(toWingetError(new Error("nope")).kind).toBe("Io");
  });
});

describe("errorMessage", () => {
  it("produces a message for every variant it is given", () => {
    const samples = [
      { kind: "NotInstalled" },
      { kind: "NotFound" },
      { kind: "NeedsElevation" },
      { kind: "SourceBusy" },
      { kind: "HashMismatch" },
      { kind: "Cancelled" },
      { kind: "Timeout", detail: 60 },
      { kind: "Network", detail: "dns failure" },
      { kind: "CommandFailed", detail: { code: 5, message: "denied" } },
      { kind: "Unsupported", detail: { found: "1.2", minimum: "1.6" } },
    ] as const;

    for (const sample of samples) {
      const message = errorMessage(sample);
      expect(message).toBeTruthy();
      // A missing translation would leak the raw lookup key.
      expect(message.startsWith("error.")).toBe(false);
    }
  });

  it("appends winget's own text when there is some", () => {
    expect(
      errorMessage({ kind: "CommandFailed", detail: { code: 1, message: "denied" } }),
    ).toContain("denied");
  });
});

describe("classifiers", () => {
  it("identifies elevation errors", () => {
    expect(needsElevation({ kind: "NeedsElevation" })).toBe(true);
    expect(needsElevation({ kind: "NotFound" })).toBe(false);
  });

  it("identifies transient errors", () => {
    expect(isRetryable({ kind: "SourceBusy" })).toBe(true);
    expect(isRetryable({ kind: "Timeout", detail: 60 })).toBe(true);
    expect(isRetryable({ kind: "HashMismatch" })).toBe(false);
  });
});
