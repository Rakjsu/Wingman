import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
  {
    name: "7-Zip",
    id: "7zip.7zip",
    version: "23.01",
    available: null,
    source: "winget",
  },
];

const upgradable: Package[] = [
  {
    name: "Visual Studio Code",
    id: "Microsoft.VisualStudioCode",
    version: "1.85.0",
    available: "1.86.0",
    source: "winget",
  },
];

function mockBackend(overrides: Record<string, unknown> = {}) {
  invokeMock.mockImplementation((cmd: string) => {
    const table: Record<string, unknown> = {
      check_winget: startup,
      list_installed: installed,
      list_upgradable: upgradable,
      search: [],
      ...overrides,
    };
    if (cmd in table) return Promise.resolve(table[cmd]);
    return Promise.resolve(undefined);
  });
}

/** The section buttons live in the sidebar; package cards reuse the same words. */
const nav = () => within(screen.getByRole("navigation", { name: "Main sections" }));

describe("App", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    window.localStorage.clear();
    // The active language lives in module state, so it survives between tests
    // unless it is put back explicitly.
    setLang("en");
    mockBackend();
  });

  it("shows the featured catalogue on first paint", async () => {
    render(<App />);
    expect(await screen.findByText("Popular packages")).toBeInTheDocument();
    expect(screen.getByText("Visual Studio Code")).toBeInTheDocument();
  });

  it("loads the installed list and lets you switch to it", async () => {
    render(<App />);
    await waitFor(() =>
      expect(invokeMock.mock.calls.some(([cmd]) => cmd === "list_installed")).toBe(true),
    );

    await userEvent.click(nav().getByRole("button", { name: /^Installed/ }));
    expect(await screen.findByText("7-Zip")).toBeInTheDocument();
  });

  it("asks for confirmation before uninstalling", async () => {
    render(<App />);
    await userEvent.click(nav().getByRole("button", { name: /^Installed/ }));
    await screen.findByText("7-Zip");

    await userEvent.click(screen.getByRole("button", { name: "Uninstall" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/Remove 7-Zip\?/)).toBeInTheDocument();
    // Nothing should have been sent to winget yet.
    expect(invokeMock).not.toHaveBeenCalledWith("uninstall", expect.anything());
  });

  it("uninstalls once the dialog is confirmed", async () => {
    render(<App />);
    await userEvent.click(nav().getByRole("button", { name: /^Installed/ }));
    await screen.findByText("7-Zip");
    await userEvent.click(screen.getByRole("button", { name: "Uninstall" }));

    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Uninstall" }));

    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith("uninstall", { id: "7zip.7zip" }),
    );
  });

  it("only queries upgrades when the Updates section is opened", async () => {
    render(<App />);
    await screen.findByText("Popular packages");
    const askedForUpgrades = () =>
      invokeMock.mock.calls.some(([cmd]) => cmd === "list_upgradable");
    expect(askedForUpgrades()).toBe(false);

    await userEvent.click(nav().getByRole("button", { name: /^Updates/ }));
    await waitFor(() => expect(askedForUpgrades()).toBe(true));
  });

  it("searches after the query settles", async () => {
    render(<App />);
    await screen.findByText("Popular packages");

    await userEvent.type(
      screen.getByRole("searchbox", { name: /search packages/i }),
      "vscode",
    );

    await waitFor(
      () =>
        expect(invokeMock).toHaveBeenCalledWith("search", {
          query: "vscode",
          source: null,
        }),
      { timeout: 2000 },
    );
  });

  it("switches language without a reload", async () => {
    render(<App />);
    await screen.findByText("Popular packages");

    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Language" }),
      "pt",
    );

    expect(await screen.findByText("Pacotes populares")).toBeInTheDocument();
  });

  it("renders the onboarding screen when winget is missing", async () => {
    mockBackend({
      check_winget: { ...startup, error: { kind: "NotInstalled" }, winget_version: null },
    });
    render(<App />);
    expect(await screen.findByText("winget is required")).toBeInTheDocument();
  });

  it("shows a shortcuts dialog on ?", async () => {
    render(<App />);
    await screen.findByText("Popular packages");

    await userEvent.keyboard("?");
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Keyboard shortcuts")).toBeInTheDocument();
  });
});
