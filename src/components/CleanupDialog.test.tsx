import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { setLang } from "../i18n";
import type { CleanResult, LeftoverItem } from "../lib/types";
import { CleanupDialog, type CleanupRequest } from "./CleanupDialog";

const invokeMock = vi.mocked(invoke);

const items: LeftoverItem[] = [
  {
    id: "lo-0",
    kind: "folder",
    path: "C:\\Users\\me\\AppData\\Local\\FooApp",
    sizeBytes: 1024 * 1024 * 3,
    reason: "nameMatch",
    confidence: "high",
    requiresAdmin: false,
  },
  {
    id: "lo-1",
    kind: "registryKey",
    path: "HKCU\\Software\\FooApp",
    sizeBytes: null,
    reason: "nameMatch",
    confidence: "high",
    requiresAdmin: false,
  },
  {
    id: "lo-2",
    kind: "registryValue",
    path: "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run → FooApp",
    sizeBytes: null,
    reason: "runKey",
    confidence: "medium",
    requiresAdmin: false,
  },
];

const request: CleanupRequest = {
  packageId: "Foo.App",
  packageName: "FooApp",
  items,
  elevated: false,
};

function setup(cleanResult?: Partial<CleanResult>) {
  const handlers = {
    onClose: vi.fn(),
    onNeedsElevation: vi.fn(),
    onToast: vi.fn(),
  };
  invokeMock.mockImplementation((cmd: string) => {
    if (cmd === "clean_leftovers") {
      return Promise.resolve({
        results: items.map((i) => ({
          id: i.id,
          ok: true,
          needsAdmin: false,
          error: null,
        })),
        backupDir: null,
        ...cleanResult,
      });
    }
    return Promise.resolve(undefined);
  });
  render(<CleanupDialog request={request} {...handlers} />);
  return handlers;
}

describe("CleanupDialog", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    setLang("en");
  });

  it("lists every leftover with its path", () => {
    setup();
    expect(screen.getByText("C:\\Users\\me\\AppData\\Local\\FooApp")).toBeInTheDocument();
    expect(screen.getByText("HKCU\\Software\\FooApp")).toBeInTheDocument();
  });

  it("pre-checks high-confidence items and leaves possible matches off", () => {
    setup();
    const boxes = screen.getAllByRole("checkbox");
    expect(boxes).toHaveLength(3);
    expect(screen.getByRole("checkbox", { name: items[0].path })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: items[1].path })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: items[2].path })).not.toBeChecked();
  });

  it("sends only the selected ids to the backend", async () => {
    setup();
    // Drop the folder, keep the registry key.
    await userEvent.click(screen.getByRole("checkbox", { name: items[0].path }));
    await userEvent.click(screen.getByRole("button", { name: /remove selected/i }));

    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith("clean_leftovers", {
        id: "Foo.App",
        itemIds: ["lo-1"],
      }),
    );
  });

  it("closes with a toast when everything was removed", async () => {
    const { onClose, onToast } = setup();
    await userEvent.click(screen.getByRole("button", { name: /remove selected/i }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onToast).toHaveBeenCalledWith(expect.stringContaining("removed"), "success");
  });

  it("stays open, shows the failure, and requests elevation when needed", async () => {
    const { onClose, onNeedsElevation } = setup({
      results: [
        { id: "lo-0", ok: true, needsAdmin: false, error: null },
        { id: "lo-1", ok: false, needsAdmin: true, error: "access denied" },
      ],
    });
    await userEvent.click(screen.getByRole("button", { name: /remove selected/i }));

    await waitFor(() => expect(screen.getByText(/access denied/)).toBeInTheDocument());
    expect(onClose).not.toHaveBeenCalled();
    expect(onNeedsElevation).toHaveBeenCalled();
  });

  it("offers keeping everything instead of deleting", async () => {
    const { onClose } = setup();
    await userEvent.click(screen.getByRole("button", { name: /keep everything/i }));
    expect(onClose).toHaveBeenCalled();
    expect(invokeMock).not.toHaveBeenCalledWith("clean_leftovers", expect.anything());
  });

  it("cannot be dismissed while a deletion is in flight", async () => {
    // Closing mid-delete pops this dialog off the queue, and the resolving
    // promise would then close the next one too.
    let release!: (value: CleanResult) => void;
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "clean_leftovers") {
        return new Promise<CleanResult>((resolve) => {
          release = resolve;
        });
      }
      return Promise.resolve(undefined);
    });
    const onClose = vi.fn();
    render(
      <CleanupDialog
        request={request}
        onClose={onClose}
        onNeedsElevation={vi.fn()}
        onToast={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /remove selected/i }));
    await waitFor(() => expect(screen.getByText(/removing/i)).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: /keep everything/i }));
    await userEvent.keyboard("{Escape}");
    expect(onClose).not.toHaveBeenCalled();

    release({
      results: [{ id: "lo-0", ok: true, needsAdmin: false, error: null }],
      backupDir: null,
    });
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it("names the registry backup in the success toast", async () => {
    // The in-dialog note is unreachable once the dialog closes, so the only
    // surviving mention of the recovery path is the toast.
    const { onToast } = setup({
      backupDir: "C:\\Users\\me\\AppData\\Local\\Wingman\\backups\\x",
    });
    await userEvent.click(screen.getByRole("button", { name: /remove selected/i }));

    await waitFor(() =>
      expect(onToast).toHaveBeenCalledWith(expect.stringContaining("backups"), "success"),
    );
  });
});
