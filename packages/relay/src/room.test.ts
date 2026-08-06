import { describe, it, expect } from "vitest";
import type { GameSummary } from "@hubbub/protocol";
import { Room } from "./room.js";
import type { GameCatalog, Outbound, TokenSource } from "./types.js";

const SUMMARIES: GameSummary[] = [
  { id: "counter", name: "Counter", minPlayers: 1 },
  { id: "two", name: "NeedsTwo", minPlayers: 2 },
];

function fakeTokens(): TokenSource {
  let n = 0;
  return { next: () => `tok${n++}` };
}
function fakeCatalog(overrides: Partial<GameCatalog> = {}): GameCatalog {
  return { summaries: SUMMARIES, settingsSchema: () => null, setup: async (_id, options) => options, ...overrides };
}
const join = (name: string, token?: string) => ({ t: "joinRoom" as const, name, colorId: 0, emoji: "🦊", token });

function findConn(out: Outbound[], connId: string, t: string) {
  return out.find((o): o is Outbound & { to: "conn" } => o.to === "conn" && o.connId === connId && o.msg.t === t)?.msg as any;
}
function findAll(out: Outbound[], t: string) {
  return out.find((o) => o.to === "all" && o.msg.t === t)?.msg as any;
}

describe("Room", () => {
  it("starts in lobby with no host", () => {
    const room = Room.create("ABCD", fakeCatalog(), fakeTokens());
    const snap = room.snapshot();
    expect(snap.mode).toBe("lobby");
    expect(snap.hostId).toBeNull();
  });

  it("first joiner becomes host, second does not", async () => {
    const room = Room.create("ABCD", fakeCatalog(), fakeTokens());
    const out1 = await room.handleMessage("c1", join("Ann"), 0);
    const joined1 = findConn(out1, "c1", "joined");
    expect(room.snapshot().hostId).toBe(joined1.playerId);

    await room.handleMessage("c2", join("Bo"), 0);
    expect(room.snapshot().hostId).toBe(joined1.playerId);
  });

  it("reconnecting with a token reclaims the same player id", async () => {
    const room = Room.create("ABCD", fakeCatalog(), fakeTokens());
    const out1 = await room.handleMessage("c1", join("Ann"), 0);
    const joined1 = findConn(out1, "c1", "joined");
    room.handleDisconnect("c1");
    expect(room.snapshot().players[joined1.playerId].connected).toBe(false);

    const out2 = await room.handleMessage("c2", join("Ann", joined1.token), 0);
    const joined2 = findConn(out2, "c2", "joined");
    expect(joined2.playerId).toBe(joined1.playerId);
    expect(Object.keys(room.snapshot().players)).toHaveLength(1);
    expect(room.snapshot().players[joined1.playerId].connected).toBe(true);
  });

  it("migrates host to the oldest connected player on disconnect, and a reconnecting former host does not reclaim it", async () => {
    const room = Room.create("ABCD", fakeCatalog(), fakeTokens());
    const a = findConn(await room.handleMessage("c1", join("Ann"), 0), "c1", "joined");
    const b = findConn(await room.handleMessage("c2", join("Bo"), 0), "c2", "joined");
    room.handleDisconnect("c1");
    expect(room.snapshot().hostId).toBe(b.playerId);

    await room.handleMessage("c3", join("Ann", a.token), 0);
    expect(room.snapshot().hostId).toBe(b.playerId);
  });

  it("transfers host only from the current host to a connected target", async () => {
    const room = Room.create("ABCD", fakeCatalog(), fakeTokens());
    const a = findConn(await room.handleMessage("c1", join("Ann"), 0), "c1", "joined");
    const b = findConn(await room.handleMessage("c2", join("Bo"), 0), "c2", "joined");

    // non-host transferHost is ignored
    await room.handleMessage("c2", { t: "transferHost", toPlayerId: a.playerId }, 0);
    expect(room.snapshot().hostId).toBe(a.playerId);

    await room.handleMessage("c1", { t: "transferHost", toPlayerId: b.playerId }, 0);
    expect(room.snapshot().hostId).toBe(b.playerId);
  });

  it("lobbyNav/lobbyFocus move and clamp the cursor, host-only", async () => {
    const room = Room.create("ABCD", fakeCatalog(), fakeTokens());
    await room.handleMessage("c1", join("Ann"), 0);
    await room.handleMessage("c2", join("Bo"), 0);

    // guest nav is ignored
    await room.handleMessage("c2", { t: "lobbyNav", dir: "right" }, 0);
    expect(room.snapshot().cursorIndex).toBe(0);

    await room.handleMessage("c1", { t: "lobbyNav", dir: "right" }, 0);
    expect(room.snapshot().cursorIndex).toBe(1);
    await room.handleMessage("c1", { t: "lobbyNav", dir: "right" }, 0); // clamps at count-1
    expect(room.snapshot().cursorIndex).toBe(1);
    await room.handleMessage("c1", { t: "lobbyFocus", index: 0 }, 0);
    expect(room.snapshot().cursorIndex).toBe(0);
  });

  it("cannot launch a game needing more connected players than are present", async () => {
    const room = Room.create("ABCD", fakeCatalog(), fakeTokens());
    await room.handleMessage("s", { t: "attachScreen" }, 0);
    await room.handleMessage("c1", join("Ann"), 0);
    await room.handleMessage("c1", { t: "lobbyFocus", index: 1 }, 0); // "two" needs 2 players
    const out = await room.handleMessage("c1", { t: "lobbyConfirm" }, 0);
    expect(findConn(out, "s", "gameLaunch")).toBeUndefined();
    expect(room.snapshot().mode).toBe("lobby");
  });

  it("launches to the screen connection and reports a setup failure only to the launching conn", async () => {
    const failing = fakeCatalog({ setup: async (_id, options: any) => { if (options?.fail) throw new Error("boom"); return options; } });
    const room = Room.create("ABCD", failing, fakeTokens());
    await room.handleMessage("s", { t: "attachScreen" }, 0);
    await room.handleMessage("c1", join("Ann"), 0);

    const failOut = await room.handleMessage("c1", { t: "lobbyConfirm", options: { fail: true } }, 0);
    const err = findConn(failOut, "c1", "error");
    expect(err.code).toBe("setup_failed");
    expect(room.snapshot().mode).toBe("lobby");

    const okOut = await room.handleMessage("c1", { t: "lobbyConfirm", options: { seed: 1 } }, 123);
    const launch = findConn(okOut, "s", "gameLaunch");
    expect(launch.gameId).toBe("counter");
    expect(launch.now).toBe(123);
    expect(room.snapshot().mode).toBe("in-game");
  });

  it("gameStatePush is only accepted from the room's own screen connection, for the live game", async () => {
    const room = Room.create("ABCD", fakeCatalog(), fakeTokens());
    await room.handleMessage("s", { t: "attachScreen" }, 0);
    await room.handleMessage("c1", join("Ann"), 0);
    await room.handleMessage("c1", { t: "lobbyConfirm" }, 0);

    // a controller pretending to push state is ignored
    const forged = await room.handleMessage("c1", { t: "gameStatePush", gameId: "counter", state: { x: 1 } }, 0);
    expect(forged).toEqual([]);

    const ok = await room.handleMessage("s", { t: "gameStatePush", gameId: "counter", state: { x: 2 } }, 0);
    expect(findAll(ok, "gameState").state).toEqual({ x: 2 });
    expect(room.snapshot().lastGameState).toEqual({ gameId: "counter", state: { x: 2 } });
  });

  it("survives a JSON round trip through snapshot()/fromSnapshot() with identical behaviour", async () => {
    const catalog = fakeCatalog();
    const tokens = fakeTokens();
    const room = Room.create("ABCD", catalog, tokens);
    const a = findConn(await room.handleMessage("c1", join("Ann"), 0), "c1", "joined");
    await room.handleMessage("c1", { t: "lobbyNav", dir: "right" }, 0);

    const revived = JSON.parse(JSON.stringify(room.snapshot()));
    const room2 = Room.fromSnapshot(revived, catalog, tokens);

    expect(room2.snapshot()).toEqual(room.snapshot());
    const out = await room2.handleMessage("c2", join("Bo"), 0);
    expect(room2.snapshot().hostId).toBe(a.playerId); // still Ann, second joiner not host
    expect(findConn(out, "c2", "joined")).toBeDefined();
    expect(room2.snapshot().cursorIndex).toBe(1); // the nav survived the round trip
  });
});
