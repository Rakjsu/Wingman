import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Package } from "../lib/types";
import { PackageRow, type RowState } from "./PackageRow";

const pkg: Package = {
  name: "Visual Studio Code",
  id: "Microsoft.VisualStudioCode",
  version: "1.85.0",
  available: null,
  source: "winget",
};

const idleState: RowState = {
  busy: false,
  queued: false,
  percent: null,
  installed: false,
  favorite: false,
  pinned: false,
};

function setup(overrides: Partial<RowState> = {}, props: Record<string, unknown> = {}) {
  const handlers = {
    onAction: vi.fn(),
    onCancel: vi.fn(),
    onToggleFavorite: vi.fn(),
    onDetails: vi.fn(),
  };
  render(
    <PackageRow
      pkg={pkg}
      action="install"
      state={{ ...idleState, ...overrides }}
      {...handlers}
      {...props}
    />,
  );
  return handlers;
}

describe("PackageRow", () => {
  it("shows the package name, id and version", () => {
    setup();
    expect(screen.getByText("Visual Studio Code")).toBeInTheDocument();
    expect(screen.getByText("Microsoft.VisualStudioCode")).toBeInTheDocument();
    expect(screen.getByText(/1\.85\.0/)).toBeInTheDocument();
  });

  it("triggers the action when the primary button is pressed", async () => {
    const { onAction } = setup();
    await userEvent.click(screen.getByRole("button", { name: /install|instalar/i }));
    expect(onAction).toHaveBeenCalledWith("install", pkg);
  });

  it("disables installing something already installed", () => {
    setup({ installed: true });
    expect(screen.getByRole("button", { name: /installed|instalado/i })).toBeDisabled();
  });

  it("offers cancel and exposes progress while busy", () => {
    const { onCancel } = setup({ busy: true, percent: 42 });
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "42");
    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /cancel|cancelar/i })).toBeInTheDocument();
  });

  it("reflects favorite state to assistive tech", async () => {
    const { onToggleFavorite } = setup({ favorite: true });
    const star = screen.getByRole("button", { name: /favorite|favoritos/i });
    expect(star).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(star);
    expect(onToggleFavorite).toHaveBeenCalledWith(pkg.id);
  });

  it("renders a selection checkbox only when selectable", () => {
    setup({}, { selectable: true, onToggleSelect: vi.fn() });
    expect(screen.getByRole("checkbox")).toBeInTheDocument();
  });

  it("falls back to the id when the name is empty", () => {
    render(
      <PackageRow
        pkg={{ ...pkg, name: "" }}
        action="install"
        state={idleState}
        onAction={vi.fn()}
        onCancel={vi.fn()}
        onToggleFavorite={vi.fn()}
        onDetails={vi.fn()}
      />,
    );
    expect(screen.getAllByText("Microsoft.VisualStudioCode").length).toBeGreaterThan(0);
  });
});
