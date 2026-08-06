import { describe, it, expect, afterEach } from "vitest";
import { WebSocket } from "ws";
import { z } from "zod";
import type { GameLogic, GameRegistry } from "@hubbub/sdk";
import { createRoomHttp, roomSocketUrl } from "@hubbub/protocol";
import { createServer } from "./server.js";
import { attachScreenAuthority } from "./test-screen.js";

// A game exercising the three new platform hooks: async setup (server-side fetch stand-in),
// ctx.now on init/onAction, and nextDeadline/onTimeout (server-forced advance on timeout).
interface TimedState { count: number; roundEndsAt: number | null }
const timedGame: GameLogic<TimedState, { by: number }> = {
  meta: { name: "TimedGame", minPlayers: 1 },
  actionSchema: z.object({ by: z.number() }),
  setup: async (options) => {
    const opts = options as { seed?: number; fail?: boolean } | undefined;
    if (opts?.fail) throw new Error("setup boom");
    return { seed: opts?.seed ?? 0 };
  },
  init: (_players, setupData, ctx) => ({
    count: (setupData as { seed: number } | undefined)?.seed ?? 0,
    roundEndsAt: (ctx?.now ?? 0) + 150,
  }),
  onAction: (s, _id, a) => ({ ...s, count: s.count + a.by }),
  onPlayersChanged: (s) => s,
  nextDeadline: (s) => s.roundEndsAt,
  onTimeout: (s) => ({ ...s, count: -1, roundEndsAt: null }),
};
const registry: GameRegistry = { timed: timedGame };

let handle: ReturnType<typeof createServer> | undefined;
afterEach(async () => await handle?.close());

const open = (url: string) =>
  new Promise<WebSocket>((res) => { const ws = new WebSocket(url); ws.on("open", () => res(ws)); });
const nextOf = (ws: WebSocket, t: string) =>
  new Promise<any>((res, rej) => {
    const timer = setTimeout(() => rej(new Error(`timeout ${t}`)), 4000);
    const h = (m: any) => { const msg = JSON.parse(m.toString()); if (msg.t === t) { clearTimeout(timer); ws.off("message", h); res(msg); } };
    ws.on("message", h);
  });
const join = (ws: WebSocket, name: string) =>
  ws.send(JSON.stringify({ t: "joinRoom", name, colorId: 0, emoji: "🐱" }));

async function setup() {
  handle = createServer(0, registry);
  const port = (handle.server.address() as { port: number }).port;
  const base = `ws://localhost:${port}`;
  const code = await createRoomHttp(base);
  const screen = await open(roomSocketUrl(base, code));
  screen.send(JSON.stringify({ t: "attachScreen" }));
  await nextOf(screen, "roomCreated");
  attachScreenAuthority(screen, registry);
  const host = await open(roomSocketUrl(base, code)); join(host, "Ann"); await nextOf(host, "joined");
  return { base, screen, host, code };
}

describe("async setup hook", () => {
  it("awaits setup before init, threading options into the resulting state", async () => {
    const { screen, host } = await setup();
    host.send(JSON.stringify({ t: "lobbyConfirm", options: { seed: 42 } }));
    const gs = await nextOf(screen, "gameState");
    expect(gs.state.count).toBe(42);
    screen.close(); host.close();
  });

  it("reports a setup failure to the launching socket and stays in the lobby", async () => {
    const { screen, host } = await setup();
    host.send(JSON.stringify({ t: "lobbyConfirm", options: { fail: true } }));
    const err = await nextOf(host, "error");
    expect(err.code).toBe("setup_failed");
    // no gameState should ever arrive - send one more control message and confirm we're still in lobby
    host.send(JSON.stringify({ t: "lobbyFocus", index: 0 }));
    const room = await nextOf(screen, "roomState");
    expect(room.mode).toBe("lobby");
    screen.close(); host.close();
  });
});

describe("server-scheduled timeout", () => {
  it("advances state on its own once the game's nextDeadline passes, with no client action", async () => {
    const { screen, host } = await setup();
    host.send(JSON.stringify({ t: "lobbyConfirm", options: { seed: 1 } }));
    const launched = await nextOf(screen, "gameState");
    expect(launched.state.count).toBe(1);

    const timedOut = await nextOf(screen, "gameState");
    expect(timedOut.state.count).toBe(-1);
    expect(timedOut.state.roundEndsAt).toBeNull();
    screen.close(); host.close();
  });
});
