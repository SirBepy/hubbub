import { describe, it, expect, afterEach } from "vitest";
import { WebSocket } from "ws";
import { z } from "zod";
import type { GameLogic, GameRegistry, SettingsSchema } from "@hubbub/sdk";
import { createRoomHttp, roomSocketUrl } from "@hubbub/protocol";
import { noopLogger } from "@hubbub/relay";
import { createServer } from "./server.js";
import { attachScreenAuthority } from "./test-screen.js";

// A fixture id + fixture schema, owned entirely by this test file: no real game's id or
// settings-schema.ts can turn this suite red (todo 55, closing the seam todo 48 hit).
interface FakeState { launchedWith: unknown }
const fakeConfigurable: GameLogic<FakeState, {}> = {
  meta: { name: "FakeConfigurable", minPlayers: 1 },
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
const registry: GameRegistry = { "fixture-configurable": fakeConfigurable, schemaless }; // index 0, 1

const fixtureSchema: SettingsSchema = [
  {
    key: "roundMode", label: "Round Mode", type: "choice", default: "classic",
    options: [{ value: "classic", label: "Classic" }, { value: "blitz", label: "Blitz" }, { value: "marathon", label: "Marathon" }],
  },
  {
    key: "source", label: "Source", type: "choice", default: "builtin",
    options: [{ value: "builtin", label: "Builtin" }, { value: "custom", label: "Custom" }],
  },
  { key: "playlistUrl", label: "Playlist URL", type: "text", default: "", showIf: { field: "source", value: "custom" } },
];
function settingsSchema(gameId: string): SettingsSchema | null {
  return gameId === "fixture-configurable" ? fixtureSchema : null;
}
function schemaField(key: string) {
  const f = fixtureSchema.find((field) => field.key === key);
  if (!f) throw new Error(`fixture schema has no "${key}" field`);
  return f;
}
const roundModeField = schemaField("roundMode");
const roundModeValues = (roundModeField.options ?? []).map((o) => o.value);
const cycleRoundMode = (from: string, dir: 1 | -1) =>
  roundModeValues[(roundModeValues.indexOf(from) + dir + roundModeValues.length) % roundModeValues.length];
const sourceField = schemaField("source");
const sourceOptionCount = sourceField.options?.length ?? 0;
const revealSourceValue = schemaField("playlistUrl").showIf?.value;
if (!revealSourceValue) throw new Error("fixture schema's playlistUrl field has no showIf to derive the reveal value from");

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
// A join/lobbyNav broadcast may still be queued on the screen when a checkpoint starts - read
// roomState until the predicate matches, same pattern server.lobby.test.ts already relies on.
const untilRoomState = async (ws: WebSocket, pred: (r: any) => boolean) => {
  let r = await nextOf(ws, "roomState");
  while (!pred(r)) r = await nextOf(ws, "roomState");
  return r;
};
const settle = (ms: number) => new Promise((r) => setTimeout(r, ms));
const join = (ws: WebSocket, name: string) =>
  ws.send(JSON.stringify({ t: "joinRoom", name, colorId: 0, avatarId: "🐱" }));

async function setup() {
  handle = createServer(0, registry, {}, noopLogger, settingsSchema);
  const port = (handle.server.address() as { port: number }).port;
  const base = `ws://localhost:${port}`;
  const code = await createRoomHttp(base);
  const screen = await open(roomSocketUrl(base, code));
  screen.send(JSON.stringify({ t: "attachScreen" }));
  await nextOf(screen, "roomCreated");
  attachScreenAuthority(screen, registry);
  const host = await open(roomSocketUrl(base, code)); join(host, "Ann"); await nextOf(host, "joined");
  return { port, base, screen, host, code };
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
    const room = await startConfiguring(screen, host); // cursor already at index 0, "fixture-configurable"
    expect(room.config.gameId).toBe("fixture-configurable");
    expect(room.config.cursorIndex).toBe(0);
    expect(room.config.values.roundMode).toBe(roundModeField.default);
    screen.close(); host.close();
  });

  it("is host-only: a non-host's config* messages are all ignored", async () => {
    const { base, screen, host, code } = await setup();
    const guest = await open(roomSocketUrl(base, code)); join(guest, "Bo"); await nextOf(guest, "joined");
    guest.send(JSON.stringify({ t: "configStart" }));
    await settle(150);
    await startConfiguring(screen, host);

    guest.send(JSON.stringify({ t: "configCursor", dir: "down" }));
    guest.send(JSON.stringify({ t: "configAdjust", field: "roundMode", dir: "right" }));
    guest.send(JSON.stringify({ t: "configConfirm" }));
    await settle(200);

    host.send(JSON.stringify({ t: "configConfirm" })); // launches with untouched defaults
    const gs = await nextOf(screen, "gameState");
    expect(gs.gameId).toBe("fixture-configurable");
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
    const afterRight = cycleRoundMode(roundModeField.default, 1);
    host.send(JSON.stringify({ t: "configAdjust", field: "roundMode", dir: "right" }));
    let room = await untilRoomState(screen, (r) => r.config.values.roundMode !== roundModeField.default);
    expect(room.config.values.roundMode).toBe(afterRight);
    host.send(JSON.stringify({ t: "configAdjust", field: "roundMode", dir: "left" }));
    room = await untilRoomState(screen, (r) => r.config.values.roundMode !== afterRight);
    expect(room.config.values.roundMode).toBe(roundModeField.default);
    const afterWrapLeft = cycleRoundMode(roundModeField.default, -1);
    host.send(JSON.stringify({ t: "configAdjust", field: "roundMode", dir: "left" }));
    room = await untilRoomState(screen, (r) => r.config.values.roundMode !== roundModeField.default);
    expect(room.config.values.roundMode).toBe(afterWrapLeft);
    screen.close(); host.close();
  });

  it("selecting the custom source reveals playlistUrl, settable via configSet (text fields only)", async () => {
    const { screen, host } = await setup();
    await startConfiguring(screen, host);
    let room: any;
    for (let i = 0; i < sourceOptionCount; i++) {
      host.send(JSON.stringify({ t: "configAdjust", field: "source", dir: "right" }));
      room = await nextOf(screen, "roomState");
      if (room.config.values.source === revealSourceValue) break;
    }
    expect(room.config.values.source).toBe(revealSourceValue);
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
    const afterRight = cycleRoundMode(roundModeField.default, 1);
    host.send(JSON.stringify({ t: "configAdjust", field: "roundMode", dir: "right" }));
    await untilRoomState(screen, (r) => r.config.values.roundMode === afterRight);
    const launched = Promise.all([untilRoomState(screen, (r) => r.mode === "in-game"), nextOf(screen, "gameState")]);
    host.send(JSON.stringify({ t: "configConfirm" }));
    const [room, gs] = await launched;
    expect(room.config).toBeNull();
    expect(gs.state.launchedWith).toMatchObject({ roundMode: afterRight });
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
