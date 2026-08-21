import { render } from "@testing-library/react";
import { StrictMode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listen } from "@tauri-apps/api/event";
import { useWingetEvents } from "./useWingetEvents";

const listenMock = vi.mocked(listen);

function Probe() {
  useWingetEvents(
    () => {},
    () => {},
  );
  return null;
}

describe("useWingetEvents", () => {
  beforeEach(() => {
    listenMock.mockReset();
  });

  it("unsubscribes even when listen() resolves after the effect was torn down", async () => {
    // StrictMode mounts, unmounts and remounts the effect in development. The
    // first subscription resolves only *after* its cleanup ran, which is
    // exactly the window where a leaked listener would start duplicating every
    // event.
    const unlisteners: ReturnType<typeof vi.fn>[] = [];
    const resolvers: (() => void)[] = [];

    listenMock.mockImplementation(() => {
      const unlisten = vi.fn();
      unlisteners.push(unlisten);
      return new Promise((resolve) => {
        resolvers.push(() => resolve(unlisten));
      });
    });

    render(
      <StrictMode>
        <Probe />
      </StrictMode>,
    );

    // Nothing has resolved yet, so StrictMode's teardown could not have been
    // handed an unlisten function by the naive implementation.
    for (const resolve of resolvers) resolve();
    await Promise.resolve();
    await Promise.resolve();

    const discarded = unlisteners.filter((fn) => fn.mock.calls.length > 0);
    const live = unlisteners.filter((fn) => fn.mock.calls.length === 0);

    // One pair of subscriptions belongs to the discarded StrictMode mount and
    // must have been cleaned up; exactly one pair may stay live.
    expect(discarded.length).toBeGreaterThan(0);
    expect(live.length).toBe(2);
  });

  it("cleans up both subscriptions on unmount", async () => {
    const unlisteners: ReturnType<typeof vi.fn>[] = [];
    listenMock.mockImplementation(() => {
      const unlisten = vi.fn();
      unlisteners.push(unlisten);
      return Promise.resolve(unlisten);
    });

    const { unmount } = render(<Probe />);
    await Promise.resolve();
    await Promise.resolve();

    expect(unlisteners).toHaveLength(2);
    unmount();

    for (const unlisten of unlisteners) {
      expect(unlisten).toHaveBeenCalled();
    }
  });
});
