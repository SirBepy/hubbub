import { describe, it, expect, beforeEach } from "vitest";
import { ROOM_CODE_LENGTH } from "@hubbub/protocol";
import { RoomManager, type Identity } from "./rooms.js";

let rm: RoomManager;
beforeEach(() => (rm = new RoomManager()));

const ann: Identity = { name: "Ann", colorId: 0, emoji: "🦊" };
const bo: Identity = { name: "Bo", colorId: 1, emoji: "🐼" };

describe("RoomManager", () => {
  it("creates a retrievable room in lobby mode", () => {
    const code = rm.createRoom();
    expect(code).toHaveLength(ROOM_CODE_LENGTH);
    expect(rm.mode(code)).toBe("lobby");
    expect(rm.hostId(code)).toBeNull();
  });

  it("adds a player with identity and makes the first joiner host", () => {
    const code = rm.createRoom();
    const r = rm.join(code, ann);
    expect(r.ok).toBe(true);
    expect(rm.players(code)).toEqual([
      { id: (r as any).playerId, name: "Ann", colorId: 0, emoji: "🦊", connected: true },
    ]);
    expect(rm.hostId(code)).toBe((r as any).playerId);
    expect(rm.isHost(code, (r as any).playerId)).toBe(true);
  });

  it("does not make the second joiner host", () => {
    const code = rm.createRoom();
    const a = rm.join(code, ann) as any;
    const b = rm.join(code, bo) as any;
    expect(rm.hostId(code)).toBe(a.playerId);
    expect(rm.isHost(code, b.playerId)).toBe(false);
  });

  it("reclaims the same player id when rejoining with a token", () => {
    const code = rm.createRoom();
    const first = rm.join(code, ann) as any;
    rm.setConnected(code, first.playerId, false);
    const again = rm.join(code, ann, first.token) as any;
    expect(again.playerId).toEqual(first.playerId);
    expect(rm.players(code)).toHaveLength(1);
    expect(rm.players(code)[0].connected).toBe(true);
  });

  it("migrates host to the oldest connected player when the host disconnects", () => {
    const code = rm.createRoom();
    const a = rm.join(code, ann) as any;
    const b = rm.join(code, bo) as any;
    rm.setConnected(code, a.playerId, false);
    expect(rm.hostId(code)).toBe(b.playerId);
  });

  it("does not let a reconnecting former host reclaim host", () => {
    const code = rm.createRoom();
    const a = rm.join(code, ann) as any;
    const b = rm.join(code, bo) as any;
    rm.setConnected(code, a.playerId, false);
    rm.setConnected(code, a.playerId, true);
    expect(rm.hostId(code)).toBe(b.playerId);
  });

  it("clears host when everyone disconnects, reassigns on reconnect", () => {
    const code = rm.createRoom();
    const a = rm.join(code, ann) as any;
    rm.setConnected(code, a.playerId, false);
    expect(rm.hostId(code)).toBeNull();
    rm.setConnected(code, a.playerId, true);
    expect(rm.hostId(code)).toBe(a.playerId);
  });

  it("transfers host only from the host to a connected target", () => {
    const code = rm.createRoom();
    const a = rm.join(code, ann) as any;
    const b = rm.join(code, bo) as any;
    expect(rm.transferHost(code, b.playerId, a.playerId)).toBe(false); // non-host cannot
    expect(rm.transferHost(code, a.playerId, b.playerId)).toBe(true);
    expect(rm.hostId(code)).toBe(b.playerId);
  });

  it("updates identity in place", () => {
    const code = rm.createRoom();
    const a = rm.join(code, ann) as any;
    rm.setIdentity(code, a.playerId, { name: "Annie", colorId: 2, emoji: "🐱" });
    expect(rm.players(code)[0]).toMatchObject({ name: "Annie", colorId: 2, emoji: "🐱" });
  });

  it("moves and clamps the lobby cursor and sets it absolutely", () => {
    const code = rm.createRoom();
    rm.join(code, ann);
    rm.moveCursor(code, "left", 3); // clamp at 0
    expect(rm.cursorIndex(code)).toBe(0);
    rm.moveCursor(code, "right", 3);
    expect(rm.cursorIndex(code)).toBe(1);
    rm.moveCursor(code, "down", 3);
    expect(rm.cursorIndex(code)).toBe(2);
    rm.moveCursor(code, "right", 3); // clamp at count-1
    expect(rm.cursorIndex(code)).toBe(2);
    rm.focusCursor(code, 0, 3);
    expect(rm.cursorIndex(code)).toBe(0);
  });

  it("sets mode and current game", () => {
    const code = rm.createRoom();
    rm.setMode(code, "in-game", "ttt");
    expect(rm.mode(code)).toBe("in-game");
    expect(rm.currentGameId(code)).toBe("ttt");
  });

  it("lists only connected players via connectedPlayers", () => {
    const code = rm.createRoom();
    const a = rm.join(code, ann) as any;
    rm.join(code, bo);
    rm.setConnected(code, a.playerId, false);
    expect(rm.connectedPlayers(code).map((p) => p.name)).toEqual(["Bo"]);
  });

  it("errors when joining a missing room", () => {
    expect(rm.join("ZZZZ", ann)).toEqual({ ok: false, code: "no_room", message: expect.any(String) });
  });

  it("reports existence via has()", () => {
    const code = rm.createRoom();
    expect(rm.has(code)).toBe(true);
    expect(rm.has("ZZZZ")).toBe(false);
  });
});
