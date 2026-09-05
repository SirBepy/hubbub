// @vitest-environment jsdom
//
// Regression test for todo 85: the game view's mount point (GameTopBar/GameSlot, which is where
// SandboxFrame lives) must render as soon as a game is pending, not only once `game` state
// matches. The pre-fix App.tsx returned solely GameLoadingScreen while `game` was null, which is
// a deadlock under the sandbox driver - SandboxFrame lived inside the branch that never rendered,
// so its onConnect never fired, so nothing ever produced the first `game` state to satisfy the
// very guard blocking it. This test cannot exercise the sandbox branch itself (the root
// vitest.config.ts pins `__HUBBUB_DEV_LOADER__` to `true` for every test, which is what lets
// production rollup drop the sandbox-vs-direct branch entirely - see LazyDirectGameView in
// App.tsx), but the render-gating fix lives OUTSIDE that branch and applies identically to both
// drivers: it asserts the shared scaffold (GameTopBar) is present the instant a game is pending,
// before any `game` state has arrived.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

type Handler = (msg: any) => void;

class FakeTransport {
  private handlers: Handler[] = [];
  async connect() {}
  onMessage(fn: Handler) {
    this.handlers.push(fn);
    return () => {
      this.handlers = this.handlers.filter((h) => h !== fn);
    };
  }
  send() {}
  close() {}
  emit(msg: any) {
    for (const h of this.handlers) h(msg);
  }
}

let lastTransport: FakeTransport;

vi.mock("@hubbub/protocol/webrtc", () => ({
  // A plain function, not an arrow: App.tsx instantiates this with `new`, and only a
  // function/class can be called as a constructor.
  WebRtcClientTransport: vi.fn(function WebRtcClientTransport() {
    lastTransport = new FakeTransport();
    return lastTransport;
  }),
}));

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
    await waitFor(() => expect(lastTransport).toBeDefined(), { timeout: 10000 });

    lastTransport.emit({ t: "roomCreated", code: "ABCD" });
    lastTransport.emit({
      t: "roomState",
      players: [{ id: "p1", name: "Bepy", colorId: 0, avatarId: "bear", connected: true }],
      hostId: "p1",
      mode: "in-game",
      currentGameId: "tap-race",
      cursorIndex: 0,
      games: [{ id: "tap-race", name: "Tap Race", minPlayers: 1 }],
      suggestions: [],
      config: null,
      inputLegend: [],
    });
    lastTransport.emit({
      t: "gameLaunch",
      gameId: "tap-race",
      players: [{ id: "p1", name: "Bepy" }],
      setupData: null,
      now: Date.now(),
    });

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
