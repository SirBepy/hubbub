// Shared by the App render tests. vi.mock factories are hoisted above static imports, so a test
// file reaches this module through `await import` inside its factory, never a top-level import.
type Handler = (msg: any) => void;

export class FakeTransport {
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

export const harness: { last?: FakeTransport } = {};

/** Creates a room and launches Tap Race, leaving the game pending: no `game` state has arrived. */
export function launchPendingGame(transport: FakeTransport) {
  transport.emit({ t: "roomCreated", code: "ABCD" });
  transport.emit({
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
  transport.emit({
    t: "gameLaunch",
    gameId: "tap-race",
    players: [{ id: "p1", name: "Bepy" }],
    setupData: null,
    now: Date.now(),
  });
}
