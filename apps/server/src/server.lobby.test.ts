import { describe, it, expect, afterEach } from "vitest";
import { WebSocket } from "ws";
import { z } from "zod";
import type { GameLogic, GameRegistry } from "@hubbub/sdk";
import { createRoomHttp, roomSocketUrl } from "@hubbub/protocol";
import { noopLogger } from "@hubbub/relay";
import { createServer } from "./server.js";
import { attachScreenAuthority } from "./test-screen.js";

interface S { count: number; owner: string | null }
const counter: GameLogic<S, { by: number }> = {
  meta: { name: "Counter", minPlayers: 1 },
  actionSchema: z.object({ by: z.number() }),
  init: (p) => ({ count: 0, owner: p[0]?.id ?? null }),
  onAction: (s, id, a) => (id === s.owner ? { ...s, count: s.count + a.by } : s),
  onPlayersChanged: (s) => s,
};
const two: GameLogic<{ ok: boolean }, {}> = {
  meta: { name: "NeedsTwo", minPlayers: 2 },
  actionSchema: z.object({}),
  init: () => ({ ok: true }),
  onAction: (s) => s,
  onPlayersChanged: (s) => s,
};
const registry: GameRegistry = { counter, two }; // index 0 = counter, 1 = two

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
// resolve after `ms` with the LAST roomState seen (for asserting no-op host gating)
const settle = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function setup() {
  handle = createServer(0, registry, {}, noopLogger);
  const port = (handle.server.address() as { port: number }).port;
  const base = `ws://localhost:${port}`;
  const code = await createRoomHttp(base);
  const screen = await open(roomSocketUrl(base, code));
  screen.send(JSON.stringify({ t: "attachScreen" }));
  await nextOf(screen, "roomCreated");
  attachScreenAuthority(screen, registry);
  return { port, base, screen, code };
}
const join = (ws: WebSocket, name: string) =>
  ws.send(JSON.stringify({ t: "joinRoom", name, colorId: 0, avatarId: "🐱" }));

describe("lobby mechanics", () => {
  it("first joiner is host, second is not; non-host confirm is ignored", async () => {
    const { base, screen, code } = await setup();
    const host = await open(roomSocketUrl(base, code)); join(host, "Ann");
    const hj = await nextOf(host, "joined");
    const guest = await open(roomSocketUrl(base, code)); join(guest, "Bo");
    await nextOf(guest, "joined");
    let room = await nextOf(screen, "roomState");
    expect(room.hostId).toBe(hj.playerId);

    // non-host tries to launch -> ignored (still lobby)
    guest.send(JSON.stringify({ t: "lobbyConfirm" }));
    await settle(150);
    // host navigates to the counter (index 0 already) and launches
    host.send(JSON.stringify({ t: "lobbyConfirm" }));
    const gs = await nextOf(screen, "gameState");
    expect(gs.gameId).toBe("counter");
    screen.close(); host.close(); guest.close();
  });

  it("lobbyNav moves the cursor and lobbyConfirm launches the highlighted game", async () => {
    const { base, screen, code } = await setup();
    const host = await open(roomSocketUrl(base, code)); join(host, "Ann"); await nextOf(host, "joined");
    const guest = await open(roomSocketUrl(base, code)); join(guest, "Bo"); await nextOf(guest, "joined");
    host.send(JSON.stringify({ t: "lobbyNav", dir: "right" })); // -> index 1 (two)
    let moved = await nextOf(screen, "roomState");
    // earlier join broadcasts may still be queued on the screen; read until the cursor moves
    while (moved.cursorIndex !== 1) moved = await nextOf(screen, "roomState");
    expect(moved.cursorIndex).toBe(1);
    host.send(JSON.stringify({ t: "lobbyConfirm" }));
    const gs = await nextOf(screen, "gameState");
    expect(gs.gameId).toBe("two");
    screen.close(); host.close(); guest.close();
  });

  it("cannot launch a game needing more players than are connected", async () => {
    const { base, screen, code } = await setup();
    const host = await open(roomSocketUrl(base, code)); join(host, "Ann"); await nextOf(host, "joined");
    host.send(JSON.stringify({ t: "lobbyFocus", index: 1 })); // 'two' needs 2 players
    await nextOf(screen, "roomState");
    host.send(JSON.stringify({ t: "lobbyConfirm" }));
    await settle(200); // no game should start
    // focusing back to counter (minPlayers 1) launches fine with the single host
    host.send(JSON.stringify({ t: "lobbyFocus", index: 0 }));
    await nextOf(screen, "roomState");
    host.send(JSON.stringify({ t: "lobbyConfirm" }));
    const gs = await nextOf(screen, "gameState");
    expect(gs.gameId).toBe("counter");
    screen.close(); host.close();
  });

  it("routes actions in-game and returns to lobby on host returnToLobby", async () => {
    const { base, screen, code } = await setup();
    const host = await open(roomSocketUrl(base, code)); join(host, "Ann"); await nextOf(host, "joined");
    host.send(JSON.stringify({ t: "lobbyConfirm" })); // counter (index 0), 1 player ok
    const gs = await nextOf(screen, "gameState");
    expect(gs.state.count).toBe(0);
    host.send(JSON.stringify({ t: "action", payload: { by: 5 } }));
    const after = await nextOf(screen, "gameState");
    expect(after.state.count).toBe(5);
    host.send(JSON.stringify({ t: "returnToLobby" }));
    const room = await nextOf(screen, "roomState");
    expect(room.mode).toBe("lobby");
    screen.close(); host.close();
  });

  it("migrates host when the host disconnects", async () => {
    const { base, screen, code } = await setup();
    const host = await open(roomSocketUrl(base, code)); join(host, "Ann"); const hj = await nextOf(host, "joined");
    const guest = await open(roomSocketUrl(base, code)); join(guest, "Bo"); const gj = await nextOf(guest, "joined");
    await nextOf(screen, "roomState");
    host.close();
    let room = await nextOf(screen, "roomState");
    // the disconnect may arrive before host migration broadcast; read until host changes
    while (room.hostId === hj.playerId) room = await nextOf(screen, "roomState");
    expect(room.hostId).toBe(gj.playerId);
    screen.close(); guest.close();
  });
});
