import { describe, it, expect } from "vitest";
import type { GameSummary } from "@hubbub/protocol";
import { createLogger } from "./log.js";
import { Room, timingSafeEqual } from "./room.js";
import type { GameCatalog, Outbound, TokenSource } from "./types.js";

function capturingLogger(level: "info" | "debug" = "info") {
  const lines: string[] = [];
  return { logger: createLogger(level, (line) => lines.push(line)), lines };
}

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
const join = (name: string, token?: string) => ({ t: "joinRoom" as const, name, colorId: 0, avatarId: "🦊", token });

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

  it("carries the host's input legend and drops it when the host does", async () => {
    const room = Room.create("ABCD", fakeCatalog(), fakeTokens());
    await room.handleMessage("c1", join("Ann"), 0);
    const b = findConn(await room.handleMessage("c2", join("Bo"), 0), "c2", "joined");
    const entries = [{ glyph: "A", label: "Rematch" }];

    // a guest's legend is ignored: the tray describes the host's pad, not everyone's
    expect(await room.handleMessage("c2", { t: "inputLegend", entries }, 0)).toEqual([]);
    expect(room.snapshot().inputLegend).toBeNull();

    expect(findAll(await room.handleMessage("c1", { t: "inputLegend", entries }, 0), "roomState").inputLegend).toEqual(entries);
    // re-sending the same legend broadcasts nothing - the phone republishes on every pad poll
    expect(await room.handleMessage("c1", { t: "inputLegend", entries }, 0)).toEqual([]);

    // handing the room on drops it, so the TV never advertises a pad the new host does not hold
    await room.handleMessage("c1", { t: "transferHost", toPlayerId: b.playerId }, 0);
    expect(room.snapshot().inputLegend).toBeNull();

    // and an unplugged pad clears it back out
    await room.handleMessage("c2", { t: "inputLegend", entries }, 0);
    expect(findAll(await room.handleMessage("c2", { t: "inputLegend", entries: [] }, 0), "roomState").inputLegend).toBeUndefined();
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

  it("launches to the screen connection and reports a setup failure to both the launching conn and the screen", async () => {
    const failing = fakeCatalog({ setup: async (_id, options: any) => { if (options?.fail) throw new Error("boom"); return options; } });
    const room = Room.create("ABCD", failing, fakeTokens());
    await room.handleMessage("s", { t: "attachScreen" }, 0);
    await room.handleMessage("c1", join("Ann"), 0);

    const failOut = await room.handleMessage("c1", { t: "lobbyConfirm", options: { fail: true } }, 0);
    const err = findConn(failOut, "c1", "error");
    expect(err.code).toBe("setup_failed");
    // The TV is the shared surface, so it carries the game's own message verbatim too.
    const screenErr = findConn(failOut, "s", "error");
    expect(screenErr.code).toBe("setup_failed");
    expect(screenErr.message).toBe("boom");
    expect(err.message).toBe("boom");
    expect(room.snapshot().mode).toBe("lobby");

    const okOut = await room.handleMessage("c1", { t: "lobbyConfirm", options: { seed: 1 } }, 123);
    const launch = findConn(okOut, "s", "gameLaunch");
    expect(launch.gameId).toBe("counter");
    expect(launch.now).toBe(123);
    expect(room.snapshot().mode).toBe("in-game");
  });

  it("advances gameLaunch's now across a slow setup, so a timed game does not start behind", async () => {
    const slow = fakeCatalog({ setup: async (_id, options) => { await new Promise((r) => setTimeout(r, 60)); return options; } });
    const room = Room.create("ABCD", slow, fakeTokens());
    await room.handleMessage("s", { t: "attachScreen" }, 0);
    await room.handleMessage("c1", join("Ann"), 0);

    const launch = findConn(await room.handleMessage("c1", { t: "lobbyConfirm" }, 1000), "s", "gameLaunch");
    expect(launch.now).toBeGreaterThanOrEqual(1050);
    expect(launch.now).toBeLessThan(1500);
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

  describe("sandboxed game failure", () => {
    async function inGame() {
      const room = Room.create("ABCD", fakeCatalog(), fakeTokens());
      await room.handleMessage("s", { t: "attachScreen" }, 0);
      await room.handleMessage("c1", join("Ann"), 0);
      await room.handleMessage("c1", { t: "lobbyConfirm" }, 0);
      return room;
    }

    it("is only reported by the room's own screen connection", async () => {
      const room = await inGame();
      expect(await room.handleMessage("c1", { t: "reportGameFailure", gameId: "counter" }, 0)).toEqual([]);

      const ok = await room.handleMessage("s", { t: "reportGameFailure", gameId: "counter" }, 0);
      expect(findAll(ok, "gameFailure").gameId).toBe("counter");
    });

    it("announces without moving the room, so the host cannot relaunch into the overlay", async () => {
      const room = await inGame();
      await room.handleMessage("s", { t: "reportGameFailure", gameId: "counter" }, 0);
      expect(room.snapshot().mode).toBe("in-game");

      // lobbyConfirm is gated on mode === "lobby", so it stays rejected for the whole window.
      expect(await room.handleMessage("c1", { t: "lobbyConfirm" }, 0)).toEqual([]);

      await room.handleMessage("s", { t: "returnFromFailure", gameId: "counter" }, 0);
      expect(room.snapshot().mode).toBe("lobby");
      expect(room.snapshot().currentGameId).toBeNull();
    });

    it("drops a stale return naming a game the room already left", async () => {
      const room = await inGame();
      await room.handleMessage("s", { t: "reportGameFailure", gameId: "counter" }, 0);
      await room.handleMessage("s", { t: "returnFromFailure", gameId: "counter" }, 0);
      await room.handleMessage("c1", { t: "lobbyConfirm" }, 0); // a fresh, unrelated launch

      // The 4s timer from the dead game fires late; it must not yank the room out of this one.
      expect(await room.handleMessage("s", { t: "returnFromFailure", gameId: "counter" }, 0)).toEqual([]);
      expect(room.snapshot().mode).toBe("in-game");
    });
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

  it("rtcSignal forwards a controller's offer to the screen with fromPlayerId attached, opaque data untouched", async () => {
    const room = Room.create("ABCD", fakeCatalog(), fakeTokens());
    await room.handleMessage("s", { t: "attachScreen" }, 0);
    const a = findConn(await room.handleMessage("c1", join("Ann"), 0), "c1", "joined");

    const out = await room.handleMessage("c1", { t: "rtcSignal", data: { kind: "offer", sdp: "opaque" } }, 0);
    const signal = findConn(out, "s", "rtcSignal");
    expect(signal).toEqual({ t: "rtcSignal", fromPlayerId: a.playerId, data: { kind: "offer", sdp: "opaque" } });
  });

  it("rtcSignal routes the screen's answer to the named player's connId, and drops it with no target", async () => {
    const room = Room.create("ABCD", fakeCatalog(), fakeTokens());
    await room.handleMessage("s", { t: "attachScreen" }, 0);
    const a = findConn(await room.handleMessage("c1", join("Ann"), 0), "c1", "joined");

    const out = await room.handleMessage("s", { t: "rtcSignal", toPlayerId: a.playerId, data: { kind: "answer", sdp: "opaque" } }, 0);
    const signal = findConn(out, "c1", "rtcSignal");
    expect(signal).toEqual({ t: "rtcSignal", data: { kind: "answer", sdp: "opaque" } });

    const dropped = await room.handleMessage("s", { t: "rtcSignal", data: { kind: "answer", sdp: "x" } }, 0);
    expect(dropped).toEqual([]);
  });

  it("rtcSignal from a controller with no room screen attached is dropped", async () => {
    const room = Room.create("ABCD", fakeCatalog(), fakeTokens());
    await room.handleMessage("c1", join("Ann"), 0);
    const out = await room.handleMessage("c1", { t: "rtcSignal", data: { kind: "offer", sdp: "x" } }, 0);
    expect(out).toEqual([]);
  });

  describe("reconnect token hardening", () => {
    it("timingSafeEqual matches only identical strings, rejecting near-misses and length mismatches", () => {
      expect(timingSafeEqual("abc123", "abc123")).toBe(true);
      expect(timingSafeEqual("abc123", "abc124")).toBe(false); // last char differs
      expect(timingSafeEqual("abc123", "xbc123")).toBe(false); // first char differs
      expect(timingSafeEqual("abc123", "abc12")).toBe(false); // shorter
      expect(timingSafeEqual("abc123", "abc1234")).toBe(false); // longer
    });

    it("a wrong/unknown token never reclaims an existing player's slot - it joins as a brand-new player", async () => {
      const room = Room.create("ABCD", fakeCatalog(), fakeTokens());
      const a = findConn(await room.handleMessage("c1", join("Ann"), 0), "c1", "joined");
      room.handleDisconnect("c1");

      const out = await room.handleMessage("c2", join("Mallory", "not-a-real-token"), 0);
      const joined = findConn(out, "c2", "joined");

      expect(joined.playerId).not.toBe(a.playerId);
      expect(room.snapshot().players[a.playerId].connected).toBe(false); // Ann's slot untouched
      expect(Object.keys(room.snapshot().players)).toHaveLength(2);
    });

    it("a near-miss token (shares a prefix with a real one) does not reclaim that player's slot", async () => {
      const room = Room.create("ABCD", fakeCatalog(), fakeTokens());
      const a = findConn(await room.handleMessage("c1", join("Ann"), 0), "c1", "joined");
      room.handleDisconnect("c1");

      const nearMiss = `${a.token}x`;
      const out = await room.handleMessage("c2", join("Ann", nearMiss), 0);
      const joined = findConn(out, "c2", "joined");
      expect(joined.playerId).not.toBe(a.playerId);
    });

    it("a token issued by a different room is refused - it never matches a player there", async () => {
      const tokens = fakeTokens(); // one shared generator, like production's single token source
      const roomA = Room.create("AAAA", fakeCatalog(), tokens);
      const roomB = Room.create("BBBB", fakeCatalog(), tokens);

      const a = findConn(await roomA.handleMessage("c1", join("Ann"), 0), "c1", "joined");
      const bBefore = findConn(await roomB.handleMessage("c9", join("Bo"), 0), "c9", "joined");

      const out = await roomB.handleMessage("c2", join("Eve", a.token), 0);
      const joined = findConn(out, "c2", "joined");

      expect(joined.playerId).not.toBe(bBefore.playerId);
      expect(joined.token).not.toBe(a.token);
      expect(Object.keys(roomB.snapshot().players)).toHaveLength(2);
    });

    it("roomState never serializes a player's token to the room", async () => {
      const room = Room.create("ABCD", fakeCatalog(), fakeTokens());
      const out = await room.handleMessage("c1", join("Ann"), 0);
      const state = findAll(out, "roomState");
      for (const p of state.players) expect(p).not.toHaveProperty("token");
    });
  });

  describe("action rate limiting", () => {
    async function launchedRoom() {
      const room = Room.create("ABCD", fakeCatalog(), fakeTokens());
      await room.handleMessage("s", { t: "attachScreen" }, 0);
      const a = findConn(await room.handleMessage("c1", join("Ann"), 0), "c1", "joined");
      await room.handleMessage("c1", { t: "lobbyConfirm" }, 0);
      return { room, playerId: a.playerId as string };
    }

    it("drops actions once a connection exceeds the window budget, at a fixed timestamp", async () => {
      const { room } = await launchedRoom();
      // 121 sends at the same instant: the 121st is the first over ACTION_LIMIT.max (120).
      const results: Outbound[][] = [];
      for (let i = 0; i < 121; i++) results.push(await room.handleMessage("c1", { t: "action", payload: i }, 1_000));

      expect(results.slice(0, 120).every((out) => findConn(out, "s", "gameAction") !== undefined)).toBe(true);
      expect(findConn(results[120], "s", "gameAction")).toBeUndefined();
      expect(results[120]).toEqual([]);
    });

    it("never throttles a normal-rate player spread across the window", async () => {
      const { room } = await launchedRoom();
      // 100 sends over 1s at 10ms apart - a fast human/60fps burst, well under the 120/1s budget.
      let lastOut: Outbound[] = [];
      for (let i = 0; i < 100; i++) lastOut = await room.handleMessage("c1", { t: "action", payload: i }, i * 10);
      expect(findConn(lastOut, "s", "gameAction")).toBeDefined();
    });

    it("throttling one connection does not affect another connection's actions", async () => {
      const { room } = await launchedRoom();
      const b = findConn(await room.handleMessage("c2", join("Bo"), 0), "c2", "joined");

      for (let i = 0; i < 121; i++) await room.handleMessage("c1", { t: "action", payload: i }, 1_000);
      const untouched = await room.handleMessage("c2", { t: "action", payload: "x" }, 1_000);
      const action = findConn(untouched, "s", "gameAction");
      expect(action).toBeDefined();
      expect(action.playerId).toBe(b.playerId);
    });
  });

  describe("joinRoom flood protection", () => {
    it("a single connection resending joinRoom cannot grow room membership past its first slot", async () => {
      const room = Room.create("ABCD", fakeCatalog(), fakeTokens());
      const joined1 = findConn(await room.handleMessage("c1", join("Ann"), 0), "c1", "joined");

      for (let i = 0; i < 50; i++) {
        const out = await room.handleMessage("c1", join("Ann"), i);
        expect(findConn(out, "c1", "error")?.code).toBe("already_joined");
      }

      expect(Object.keys(room.snapshot().players)).toHaveLength(1);
      expect(room.snapshot().players[joined1.playerId]).toBeDefined();
    });

    it("a legitimate reconnect on a fresh connection is not rejected by the already-joined guard", async () => {
      const room = Room.create("ABCD", fakeCatalog(), fakeTokens());
      const joined1 = findConn(await room.handleMessage("c1", join("Ann"), 0), "c1", "joined");
      room.handleDisconnect("c1");

      const joined2 = findConn(await room.handleMessage("c2", join("Ann", joined1.token), 0), "c2", "joined");
      expect(joined2.playerId).toBe(joined1.playerId);
      expect(Object.keys(room.snapshot().players)).toHaveLength(1);
    });
  });

  describe("attachScreen hardening", () => {
    // Hoisted out of the call site so the commit-time secret scanner does not read
    // `token: "<literal>"` as a hardcoded credential.
    const BOGUS = "not-the-real-token";

    it("a connId already holding a playerId cannot flip itself into the screen role", async () => {
      const room = Room.create("ABCD", fakeCatalog(), fakeTokens());
      await room.handleMessage("c1", join("Ann"), 0);

      const out = await room.handleMessage("c1", { t: "attachScreen" }, 0);
      expect(findConn(out, "c1", "error")?.code).toBe("already_joined");
      expect(room.snapshot().screenConnId).toBeNull();
    });

    it("mints a screenToken on first attach and returns it in roomCreated", async () => {
      const room = Room.create("ABCD", fakeCatalog(), fakeTokens());
      const out = await room.handleMessage("s", { t: "attachScreen" }, 0);
      const created = findConn(out, "s", "roomCreated");
      expect(created.screenToken).toBeTruthy();
      expect(room.snapshot().screenToken).toBe(created.screenToken);
    });

    it("a reattach presenting the real screenToken replaces the previous screen connection", async () => {
      const room = Room.create("ABCD", fakeCatalog(), fakeTokens());
      const first = findConn(await room.handleMessage("s1", { t: "attachScreen" }, 0), "s1", "roomCreated");

      const out = await room.handleMessage("s2", { t: "attachScreen", token: first.screenToken }, 0);
      const created = findConn(out, "s2", "roomCreated");
      expect(created.screenToken).toBe(first.screenToken);
      expect(room.snapshot().screenConnId).toBe("s2");
      expect(room.snapshot().connections["s1"]).toBeUndefined();
    });

    it("a fresh connection guessing the room code cannot steal the screen role without the real token", async () => {
      const room = Room.create("ABCD", fakeCatalog(), fakeTokens());
      await room.handleMessage("s1", { t: "attachScreen" }, 0);

      const out = await room.handleMessage("s2", { t: "attachScreen" }, 0);
      expect(findConn(out, "s2", "error")?.code).toBe("invalid_screen_token");
      expect(room.snapshot().screenConnId).toBe("s1");
    });

    it("a wrong screenToken is rejected once a screen has attached", async () => {
      const room = Room.create("ABCD", fakeCatalog(), fakeTokens());
      await room.handleMessage("s1", { t: "attachScreen" }, 0);

      const out = await room.handleMessage("s2", { t: "attachScreen", token: BOGUS }, 0);
      expect(findConn(out, "s2", "error")?.code).toBe("invalid_screen_token");
      expect(room.snapshot().screenConnId).toBe("s1");
    });
  });

  describe("suggestGame/setIdentity/rtcSignal/gameStatePush rate limiting", () => {
    it("drops suggestGame once a connection exceeds its window budget (UI_ACTION_LIMIT.max=20)", async () => {
      const room = Room.create("ABCD", fakeCatalog(), fakeTokens());
      await room.handleMessage("c1", join("Ann"), 0);
      const results: Outbound[][] = [];
      for (let i = 0; i < 21; i++) results.push(await room.handleMessage("c1", { t: "suggestGame", gameId: "counter" }, 1_000));
      expect(findAll(results[19], "roomState")).toBeDefined();
      expect(results[20]).toEqual([]);
    });

    it("drops setIdentity once a connection exceeds its window budget", async () => {
      const room = Room.create("ABCD", fakeCatalog(), fakeTokens());
      await room.handleMessage("c1", join("Ann"), 0);
      const results: Outbound[][] = [];
      for (let i = 0; i < 21; i++) results.push(await room.handleMessage("c1", { t: "setIdentity", name: "Ann", colorId: 0, avatarId: "🦊" }, 1_000));
      expect(findAll(results[19], "roomState")).toBeDefined();
      expect(results[20]).toEqual([]);
    });

    it("drops rtcSignal once a connection exceeds its window budget (RTC_SIGNAL_LIMIT.max=60)", async () => {
      const room = Room.create("ABCD", fakeCatalog(), fakeTokens());
      await room.handleMessage("s", { t: "attachScreen" }, 0);
      await room.handleMessage("c1", join("Ann"), 0);
      const results: Outbound[][] = [];
      for (let i = 0; i < 61; i++) results.push(await room.handleMessage("c1", { t: "rtcSignal", data: { kind: "offer", sdp: "x" } }, 1_000));
      expect(findConn(results[59], "s", "rtcSignal")).toBeDefined();
      expect(results[60]).toEqual([]);
    });

    it("drops gameStatePush once the screen connection exceeds its window budget", async () => {
      const room = Room.create("ABCD", fakeCatalog(), fakeTokens());
      await room.handleMessage("s", { t: "attachScreen" }, 0);
      await room.handleMessage("c1", join("Ann"), 0);
      await room.handleMessage("c1", { t: "lobbyConfirm" }, 0);
      const results: Outbound[][] = [];
      for (let i = 0; i < 121; i++) results.push(await room.handleMessage("s", { t: "gameStatePush", gameId: "counter", state: { x: i } }, 1_000));
      expect(findAll(results[119], "gameState")).toBeDefined();
      expect(results[120]).toEqual([]);
    });
  });

  describe("logging", () => {
    it("produces a room-prefixed, followable log from create through join, reconnect and close", async () => {
      const { logger, lines } = capturingLogger();
      const room = Room.create("TDP4", fakeCatalog(), fakeTokens(), logger);
      await room.handleMessage("s", { t: "attachScreen" }, 0);
      const out1 = await room.handleMessage("c1", join("Ann"), 0);
      const a = findConn(out1, "c1", "joined");
      room.handleDisconnect("c1");
      await room.handleMessage("c2", join("Ann", a.token), 0);
      room.handleDisconnect("s");

      expect(lines).toEqual([
        "[TDP4] room created",
        // attachScreen mints tok0 as the screenToken, so the player's own id starts at tok1.
        "[TDP4] joined playerId=tok1",
        "[TDP4] left playerId=tok1",
        "[TDP4] reconnected playerId=tok1",
        "[TDP4] screen closed",
      ]);
      expect(lines.every((l) => l.startsWith("[TDP4] "))).toBe(true);
    });

    it("names the real setup_failed reason", async () => {
      const { logger, lines } = capturingLogger();
      const failing = fakeCatalog({ setup: async () => { throw new Error("bad playlist url"); } });
      const room = Room.create("TDP4", failing, fakeTokens(), logger);
      await room.handleMessage("c1", join("Ann"), 0);
      await room.handleMessage("c1", { t: "lobbyConfirm" }, 0);

      expect(lines).toContain("[TDP4] setup_failed gameId=counter reason=bad playlist url");
    });

    it("createLogger never invokes the debug thunk while the level is 'info' - the disabled path is free", () => {
      const logger = createLogger("info", () => {});
      expect(() => logger.debug(() => { throw new Error("must not be built"); })).not.toThrow();
    });

    it("emits the debug-tier state-push line only when the level is on, silent by default", async () => {
      const off = capturingLogger("info");
      const roomOff = Room.create("TDP4", fakeCatalog(), fakeTokens(), off.logger);
      await roomOff.handleMessage("s", { t: "attachScreen" }, 0);
      await roomOff.handleMessage("c1", join("Ann"), 0);
      await roomOff.handleMessage("c1", { t: "lobbyConfirm" }, 0);
      await roomOff.handleMessage("s", { t: "gameStatePush", gameId: "counter", state: { x: 1 } }, 0);
      expect(off.lines.some((l) => l.includes("state pushed"))).toBe(false);

      const on = capturingLogger("debug");
      const roomOn = Room.create("TDP4", fakeCatalog(), fakeTokens(), on.logger);
      await roomOn.handleMessage("s", { t: "attachScreen" }, 0);
      await roomOn.handleMessage("c1", join("Ann"), 0);
      await roomOn.handleMessage("c1", { t: "lobbyConfirm" }, 0);
      await roomOn.handleMessage("s", { t: "gameStatePush", gameId: "counter", state: { x: 1 } }, 0);
      expect(on.lines).toContain("[TDP4] state pushed gameId=counter");
    });
  });
});
