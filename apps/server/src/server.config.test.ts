import { describe, it, expect, afterEach } from "vitest";
import { WebSocket } from "ws";
import { z } from "zod";
import type { GameLogic, GameRegistry } from "@hubbub/sdk";
import { createServer } from "./server.js";
import { attachScreenAuthority } from "./test-screen.js";

// "music-guesser" is the only id with a real schema in @hubbub/games/settings today - reuse that
// id with a lightweight fake logic (no real Deezer fetch) to exercise the config phase generically
// against the real schema's showIf/option shape without hitting the network.
interface FakeState { launchedWith: unknown }
const fakeMusicGuesser: GameLogic<FakeState, {}> = {
  meta: { name: "FakeMusicGuesser", minPlayers: 1 },
  actionSchema: z.object({}),
  setup: async (options) => ({ launchedWith: options }),
  init: (_players, setupData) => setupData as FakeState,
  onAction: (s) => s,
  onPlayersChanged: (s) => s,
};
const schemaless: GameLogic<{ ok: boolean }, {}> = {
  meta: { name: "Schemaless", minPlayers: 1 },
  actionSchema: z.object({}),
  init: () => ({ ok: true }),
  onAction: (s) => s,
  onPlayersChanged: (s) => s,
};
const registry: GameRegistry = { "music-guesser": fakeMusicGuesser, schemaless }; // index 0, 1

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
// A join/lobbyNav broadcast may still be queued on the screen when a checkpoint starts - read
// roomState until the predicate matches, same pattern server.lobby.test.ts already relies on.
const untilRoomState = async (ws: WebSocket, pred: (r: any) => boolean) => {
  let r = await nextOf(ws, "roomState");
  while (!pred(r)) r = await nextOf(ws, "roomState");
  return r;
};
const settle = (ms: number) => new Promise((r) => setTimeout(r, ms));
const join = (ws: WebSocket, code: string, name: string) =>
  ws.send(JSON.stringify({ t: "joinRoom", code, name, colorId: 0, emoji: "🐱" }));

async function setup() {
  handle = createServer(0, registry);
  const port = (handle.wss.address() as { port: number }).port;
  const screen = await open(port);
  screen.send(JSON.stringify({ t: "createRoom" }));
  const created = await nextOf(screen, "roomCreated");
  attachScreenAuthority(screen, registry);
  const host = await open(port); join(host, created.code, "Ann"); await nextOf(host, "joined");
  return { port, screen, host, code: created.code as string };
}
async function startConfiguring(screen: WebSocket, host: WebSocket) {
  host.send(JSON.stringify({ t: "configStart" }));
  return untilRoomState(screen, (r) => r.mode === "configuring");
}

describe("config phase", () => {
  it("schema-less games skip configuring entirely and launch on configStart", async () => {
    const { screen, host } = await setup();
    host.send(JSON.stringify({ t: "lobbyNav", dir: "right" })); // -> index 1, "schemaless"
    await untilRoomState(screen, (r) => r.cursorIndex === 1);
    // roomState and gameState land back-to-back - register both listeners before sending, or a
    // same-tick pair can arrive between two sequential `await nextOf` calls and drop one.
    const launched = Promise.all([untilRoomState(screen, (r) => r.mode === "in-game"), nextOf(screen, "gameState")]);
    host.send(JSON.stringify({ t: "configStart" }));
    const [room, gs] = await launched;
    expect(room.currentGameId).toBe("schemaless");
    expect(gs.gameId).toBe("schemaless");
    screen.close(); host.close();
  });

  it("a schema-having game opens the configuring phase (with schema defaults) instead of launching", async () => {
    const { screen, host } = await setup();
    const room = await startConfiguring(screen, host); // cursor already at index 0, "music-guesser"
    expect(room.config.gameId).toBe("music-guesser");
    expect(room.config.cursorIndex).toBe(0);
    expect(room.config.values.roundMode).toBe("mixed");
    screen.close(); host.close();
  });

  it("is host-only: a non-host's config* messages are all ignored", async () => {
    const { port, screen, host, code } = await setup();
    const guest = await open(port); join(guest, code, "Bo"); await nextOf(guest, "joined");
    guest.send(JSON.stringify({ t: "configStart" }));
    await settle(150);
    await startConfiguring(screen, host);

    guest.send(JSON.stringify({ t: "configCursor", dir: "down" }));
    guest.send(JSON.stringify({ t: "configAdjust", field: "roundMode", dir: "right" }));
    guest.send(JSON.stringify({ t: "configConfirm" }));
    await settle(200);

    host.send(JSON.stringify({ t: "configConfirm" })); // launches with untouched defaults
    const gs = await nextOf(screen, "gameState");
    expect(gs.gameId).toBe("music-guesser");
    screen.close(); host.close(); guest.close();
  });

  it("configCursor moves the draft's field cursor, clamped to the visible field count", async () => {
    const { screen, host } = await setup();
    await startConfiguring(screen, host);
    host.send(JSON.stringify({ t: "configCursor", dir: "up" })); // already at 0, clamps
    let room = await nextOf(screen, "roomState");
    expect(room.config.cursorIndex).toBe(0);
    // playlistUrl is hidden by default (source != custom), so index 1 is "roundMode"
    host.send(JSON.stringify({ t: "configCursor", dir: "down" }));
    room = await nextOf(screen, "roomState");
    expect(room.config.cursorIndex).toBe(1);
    screen.close(); host.close();
  });

  it("configAdjust cycles a choice field's value, wrapping both directions", async () => {
    const { screen, host } = await setup();
    await startConfiguring(screen, host);
    host.send(JSON.stringify({ t: "configAdjust", field: "roundMode", dir: "right" })); // mixed -> title
    let room = await untilRoomState(screen, (r) => r.config.values.roundMode !== "mixed");
    expect(room.config.values.roundMode).toBe("title");
    host.send(JSON.stringify({ t: "configAdjust", field: "roundMode", dir: "left" })); // back to mixed
    room = await untilRoomState(screen, (r) => r.config.values.roundMode !== "title");
    expect(room.config.values.roundMode).toBe("mixed");
    host.send(JSON.stringify({ t: "configAdjust", field: "roundMode", dir: "left" })); // wraps to "year"
    room = await untilRoomState(screen, (r) => r.config.values.roundMode !== "mixed");
    expect(room.config.values.roundMode).toBe("year");
    screen.close(); host.close();
  });

  it("selecting the custom source reveals playlistUrl, settable via configSet (text fields only)", async () => {
    const { screen, host } = await setup();
    await startConfiguring(screen, host);
    let room: any;
    for (let i = 0; i < 12; i++) {
      host.send(JSON.stringify({ t: "configAdjust", field: "source", dir: "right" }));
      room = await nextOf(screen, "roomState");
      if (room.config.values.source === "custom") break;
    }
    expect(room.config.values.source).toBe("custom");
    host.send(JSON.stringify({ t: "configSet", field: "playlistUrl", value: "https://deezer.com/playlist/42" }));
    room = await untilRoomState(screen, (r) => r.config.values.playlistUrl === "https://deezer.com/playlist/42");
    // configSet is a no-op on a choice field
    host.send(JSON.stringify({ t: "configSet", field: "roundMode", value: "bogus" }));
    await settle(150);
    screen.close(); host.close();
  });

  it("configConfirm assembles the draft's values into options and feeds the game's setup", async () => {
    const { screen, host } = await setup();
    await startConfiguring(screen, host);
    host.send(JSON.stringify({ t: "configAdjust", field: "roundMode", dir: "right" })); // -> title
    await untilRoomState(screen, (r) => r.config.values.roundMode === "title");
    const launched = Promise.all([untilRoomState(screen, (r) => r.mode === "in-game"), nextOf(screen, "gameState")]);
    host.send(JSON.stringify({ t: "configConfirm" }));
    const [room, gs] = await launched;
    expect(room.config).toBeNull();
    expect(gs.state.launchedWith).toMatchObject({ roundMode: "title" });
    screen.close(); host.close();
  });

  it("configCancel returns to the lobby and discards the draft", async () => {
    const { screen, host } = await setup();
    await startConfiguring(screen, host);
    host.send(JSON.stringify({ t: "configCancel" }));
    const room = await untilRoomState(screen, (r) => r.mode === "lobby");
    expect(room.config).toBeNull();
    screen.close(); host.close();
  });
});
