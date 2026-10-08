// @vitest-environment jsdom
//
// Regression test for todo 85: the game view's mount point (GameTopBar/GameSlot, which is where
// SandboxFrame lives) must render as soon as a game is pending, not only once `game` state
// matches. The pre-fix App.tsx returned solely GameLoadingScreen while `game` was null, which is
// a deadlock under the sandbox driver - SandboxFrame lived inside the branch that never rendered,
// so its onConnect never fired, so nothing ever produced the first `game` state to satisfy the
// very guard blocking it. This file runs the direct-loader branch (the vitest.setup.ts default);
// App.sandbox.test.tsx runs the same launch through the sandbox branch.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { harness, launchPendingGame } from "./app-test-harness";

vi.mock("@hubbub/protocol/webrtc", async () => {
  const { FakeTransport, harness } = await import("./app-test-harness");
  return {
    // A plain function, not an arrow: App.tsx instantiates this with `new`, and only a
    // function/class can be called as a constructor.
    WebRtcClientTransport: vi.fn(function WebRtcClientTransport() {
      harness.last = new FakeTransport();
      return harness.last;
    }),
  };
});

vi.mock("@hubbub/protocol", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@hubbub/protocol")>();
  return { ...actual, createRoomHttp: vi.fn().mockResolvedValue("ABCD") };
});

// No saved session, so App.tsx takes the createFresh() path instead of tryReattach().
vi.mock("./screen-session", () => ({
  loadScreenSession: vi.fn().mockReturnValue(null),
  saveScreenSession: vi.fn(),
  clearScreenSession: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("game view mount gate (todo 85)", () => {
  it("mounts the game scaffold before the first `game` state arrives, not only after", async () => {
    const { App } = await import("./App");
    render(<App />);

    // Generous vs. the suite's default 5000ms: a jsdom render of the whole App plus its real
    // async effects (QRCode.toDataURL, several microtask hops) measurably slows down under the
    // full suite's parallel load, not just in isolation - flaked at 4000/5000ms (2026-09-05).
    await waitFor(() => expect(harness.last).toBeDefined(), { timeout: 10000 });
    launchPendingGame(harness.last!);

    // The deadlocked pre-fix render returned ONLY GameLoadingScreen here - no room code, no game
    // title bar - because the whole game-view branch was gated behind `game` matching
    // `pendingGameId`, and nothing produces that `game` state until the (unmounted) view's own
    // driver reports back. The fix mounts the scaffold immediately and overlays the loading
    // screen on top of it instead of replacing it.
    await screen.findByText("Loading", {}, { timeout: 10000 });
    // "ABCD" (the room code) only ever appears in GameTopBar, so its presence alone proves the
    // scaffold mounted - "Tap Race" appears twice once mounted (top bar title + loading key art).
    await screen.findByText("ABCD", {}, { timeout: 10000 });
    expect(screen.getAllByText("Tap Race").length).toBeGreaterThanOrEqual(2);
  }, 20000);
});
