import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import App from "./App";
import { setLang } from "./i18n";
import type { DoneEvent, Package, ScanResult, StartupInfo } from "./lib/types";

const invokeMock = vi.mocked(invoke);
const listenMock = vi.mocked(listen);

const startup: StartupInfo = {
  winget_version: "1.29.0",
  error: null,
  backend: "Cli",
  app_version: "0.1.0",
  log_dir: "C:/logs",
};

const installed: Package[] = [
  { name: "FooApp", id: "Foo.App", version: "1.0", available: null, source: "winget" },
];

const scanResult: ScanResult = {
  items: [
    {
      id: "lo-0",
      kind: "folder",
      path: "C:\\Users\\me\\AppData\\Local\\FooApp",
      sizeBytes: 2048,
      reason: "nameMatch",
      confidence: "high",
      requiresAdmin: false,
    },
  ],
  elevated: false,
};

describe("deep-clean uninstall flow", () => {
  // The event handlers registered by the app, so tests can play the backend.
  let handlers: Record<string, (event: { payload: unknown }) => void>;

  beforeEach(() => {
    invokeMock.mockReset();
    listenMock.mockReset();
    window.localStorage.clear();
    setLang("en");

    handlers = {};
    listenMock.mockImplementation((event, cb) => {
      handlers[event as string] = cb as (e: { payload: unknown }) => void;
      return Promise.resolve(() => {});
    });

    invokeMock.mockImplementation((cmd: string) => {
      const table: Record<string, unknown> = {
        check_winget: startup,
        list_installed: installed,
        list_upgradable: [],
        search: [],
        scan_leftovers: scanResult,
      };
      return Promise.resolve(cmd in table ? table[cmd] : undefined);
    });
  });

  async function uninstallWithDeepClean(deepClean: boolean) {
    render(<App />);
    const nav = within(screen.getByRole("navigation", { name: "Main sections" }));
    await userEvent.click(nav.getByRole("button", { name: /^Installed/ }));
    await screen.findByText("FooApp");
    await userEvent.click(screen.getByRole("button", { name: "Uninstall" }));

    const dialog = await screen.findByRole("dialog");
    const checkbox = within(dialog).getByRole("checkbox");
    expect(checkbox).toBeChecked(); // deep clean defaults to on
    if (!deepClean) await userEvent.click(checkbox);
    await userEvent.click(within(dialog).getByRole("button", { name: "Uninstall" }));
  }

  function backendReportsUninstallDone() {
    const done: DoneEvent = { id: "Foo.App", action: "uninstall", ok: true, error: null };
    act(() => handlers["winget-done"]?.({ payload: done }));
  }

  it("snapshots before uninstalling and scans after, then shows the preview", async () => {
    await uninstallWithDeepClean(true);

    // The ARP snapshot must be taken while the app is still installed.
    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith("prepare_cleanup", {
        id: "Foo.App",
        name: "FooApp",
      }),
    );
    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith("uninstall", { id: "Foo.App" }),
    );
    expect(invokeMock).not.toHaveBeenCalledWith("scan_leftovers", expect.anything());

    backendReportsUninstallDone();

    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith("scan_leftovers", { id: "Foo.App" }),
    );
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText("C:\\Users\\me\\AppData\\Local\\FooApp"),
    ).toBeInTheDocument();
    // Nothing has been deleted yet.
    expect(invokeMock).not.toHaveBeenCalledWith("clean_leftovers", expect.anything());
  });

  it("skips the scan entirely when the option is unticked", async () => {
    await uninstallWithDeepClean(false);
    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith("uninstall", { id: "Foo.App" }),
    );
    expect(invokeMock).not.toHaveBeenCalledWith("prepare_cleanup", expect.anything());

    backendReportsUninstallDone();

    await waitFor(() =>
      expect(invokeMock.mock.calls.some(([cmd]) => cmd === "list_installed")).toBe(true),
    );
    expect(invokeMock).not.toHaveBeenCalledWith("scan_leftovers", expect.anything());
  });

  it("reports when the scan comes back empty instead of opening a dialog", async () => {
    invokeMock.mockImplementation((cmd: string) => {
      const table: Record<string, unknown> = {
        check_winget: startup,
        list_installed: installed,
        list_upgradable: [],
        search: [],
        scan_leftovers: { items: [], elevated: false } satisfies ScanResult,
      };
      return Promise.resolve(cmd in table ? table[cmd] : undefined);
    });

    await uninstallWithDeepClean(true);
    backendReportsUninstallDone();

    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith("scan_leftovers", { id: "Foo.App" }),
    );
    expect(await screen.findByText(/No leftovers found/)).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
