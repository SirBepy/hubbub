import { describe, it, expect, afterEach } from "vitest";
import { WebSocket } from "ws";
import { tttLogic } from "@hubbub/game-tictactoe";
import { utttLogic } from "@hubbub/game-ultimate-tictactoe";
import type { GameRegistry } from "@hubbub/sdk";
import { createServer } from "./server.js";

const registry: GameRegistry = { ttt: tttLogic, uttt: utttLogic }; // index 0 = ttt, 1 = uttt

let handle: ReturnType<typeof createServer> | undefined;
afterEach(async () => await handle?.close());

const open = (port: number) =>
  new Promise<WebSocket>((res) => { const ws = new WebSocket(`ws://localhost:${port}`); ws.on("open", () => res(ws)); });
const nextOf = (ws: WebSocket, t: string) =>
  new Promise<any>((res, rej) => {
    const timer = setTimeout(() => rej(new Error(`timeout ${t}`)), 4000);
    const h = (m: any) => { const msg = JSON.parse(m.toString()); if (msg.t === t) { clearTimeout(timer); ws.off("message", h); res(msg); } };
    ws.on("message", h);
  });
const join = (ws: WebSocket, code: string, name: string) =>
  ws.send(JSON.stringify({ t: "joinRoom", code, name, colorId: 0, emoji: "🐱" }));

describe("lobby session with real games", () => {
  it("launches ttt, returns to lobby, then launches uttt with the same players", async () => {
    handle = createServer(0, registry);
    const port = (handle.wss.address() as { port: number }).port;
    const screen = await open(port);
    screen.send(JSON.stringify({ t: "createRoom" }));
    const created = await nextOf(screen, "roomCreated");

    const host = await open(port); join(host, created.code, "Ann"); await nextOf(host, "joined");
    const guest = await open(port); join(guest, created.code, "Bo"); await nextOf(guest, "joined");

    // launch ttt (index 0)
    host.send(JSON.stringify({ t: "lobbyConfirm" }));
    const ttt = await nextOf(screen, "gameState");
    expect(ttt.gameId).toBe("ttt");
    expect(ttt.state.board).toHaveLength(9);

    // back to lobby
    host.send(JSON.stringify({ t: "returnToLobby" }));
    let room = await nextOf(screen, "roomState");
    while (room.mode !== "lobby") room = await nextOf(screen, "roomState");
    expect(room.players.map((p: any) => p.name).sort()).toEqual(["Ann", "Bo"]);

    // navigate to uttt (index 1) and launch
    host.send(JSON.stringify({ t: "lobbyNav", dir: "right" }));
    await nextOf(screen, "roomState");
    host.send(JSON.stringify({ t: "lobbyConfirm" }));
    const uttt = await nextOf(screen, "gameState");
    expect(uttt.gameId).toBe("uttt");
    expect(uttt.state.boards).toHaveLength(9);

    screen.close(); host.close(); guest.close();
  });
});

describe("rematch", () => {
  it("host rematch re-inits the current game fresh; non-host rematch is ignored", async () => {
    handle = createServer(0, registry);
    const port = (handle.wss.address() as { port: number }).port;
    const screen = await open(port);
    screen.send(JSON.stringify({ t: "createRoom" }));
    const created = await nextOf(screen, "roomCreated");

    const host = await open(port); join(host, created.code, "Ann"); await nextOf(host, "joined");
    const guest = await open(port); join(guest, created.code, "Bo"); await nextOf(guest, "joined");

    host.send(JSON.stringify({ t: "lobbyConfirm" })); // launch ttt (index 0)
    const ttt = await nextOf(screen, "gameState");
    expect(ttt.gameId).toBe("ttt");

    host.send(JSON.stringify({ t: "action", payload: { cell: 0 } }));
    const played = await nextOf(screen, "gameState");
    expect(played.state.board[0]).toBe("X");

    // non-host rematch is ignored: no new gameState arrives, board stays played
    guest.send(JSON.stringify({ t: "rematch" }));
    await new Promise((r) => setTimeout(r, 150));

    host.send(JSON.stringify({ t: "rematch" }));
    const fresh = await nextOf(screen, "gameState");
    expect(fresh.gameId).toBe("ttt");
    expect(fresh.state.board.every((c: unknown) => c === null)).toBe(true);
    expect(fresh.state.winner).toBeNull();

    screen.close(); host.close(); guest.close();
  });
});
