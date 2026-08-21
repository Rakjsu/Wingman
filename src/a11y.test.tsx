import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import App from "./App";
import { setLang } from "./i18n";
import type { Package, StartupInfo } from "./lib/types";

const invokeMock = vi.mocked(invoke);

const startup: StartupInfo = {
  winget_version: "1.29.0",
  error: null,
  backend: "Cli",
  app_version: "0.1.0",
  log_dir: "C:/logs",
};

const installed: Package[] = [
  { name: "7-Zip", id: "7zip.7zip", version: "23.01", available: null, source: "winget" },
];

/**
 * Colour contrast needs real layout, which jsdom does not do, so that rule is
 * excluded here and the palette is checked by hand instead.
 */
async function findViolations(container: HTMLElement) {
  const results = await axe.run(container, {
    rules: { "color-contrast": { enabled: false }, region: { enabled: false } },
  });
  return results.violations.map((v) => `${v.id}: ${v.help}`);
}

const nav = () => within(screen.getByRole("navigation", { name: "Main sections" }));

describe("accessibility", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    window.localStorage.clear();
    setLang("en");
    invokeMock.mockImplementation((cmd: string) => {
      const table: Record<string, unknown> = {
        check_winget: startup,
        list_installed: installed,
        list_upgradable: [],
        search: [],
      };
      return Promise.resolve(cmd in table ? table[cmd] : undefined);
    });
  });

  it("has no violations on the Discover section", async () => {
    const { container } = render(<App />);
    await screen.findByText("Popular packages");
    expect(await findViolations(container)).toEqual([]);
  });

  it("has no violations on the Installed section", async () => {
    const { container } = render(<App />);
    await screen.findByText("Popular packages");
    await userEvent.click(nav().getByRole("button", { name: /^Installed/ }));
    await screen.findByText("7-Zip");
    expect(await findViolations(container)).toEqual([]);
  });

  it("has no violations in a dialog", async () => {
    const { container } = render(<App />);
    await screen.findByText("Popular packages");
    await userEvent.keyboard("?");
    await screen.findByRole("dialog");
    expect(await findViolations(container)).toEqual([]);
  });

  it("labels every interactive control on the first screen", async () => {
    render(<App />);
    await screen.findByText("Popular packages");

    await waitFor(() => {
      for (const button of screen.getAllByRole("button")) {
        const name = button.textContent?.trim() || button.getAttribute("aria-label");
        expect(name, `unlabelled button: ${button.outerHTML.slice(0, 90)}`).toBeTruthy();
      }
    });
  });
});
