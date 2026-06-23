import { describe, it, expect, beforeEach } from "vitest";
import { RoomManager } from "./rooms.js";

let rm: RoomManager;
beforeEach(() => (rm = new RoomManager()));

describe("RoomManager", () => {
  it("creates a retrievable room", () => {
    const code = rm.createRoom();
    expect(code).toHaveLength(4);
    expect(rm.hasRoom(code)).toBe(true);
  });

  it("adds a player and lists them", () => {
    const code = rm.createRoom();
    const r = rm.join(code, "Joe");
    expect(r.ok).toBe(true);
    expect(rm.players(code)).toEqual([
      { id: (r as any).playerId, name: "Joe", connected: true },
    ]);
  });

  it("reclaims the same player id when rejoining with a token", () => {
    const code = rm.createRoom();
    const first = rm.join(code, "Joe");
    expect(first.ok).toBe(true);
    const token = (first as any).token;
    rm.setConnected(code, (first as any).playerId, false);
    const again = rm.join(code, "Joe", token);
    expect(again.ok).toBe(true);
    expect((again as any).playerId).toEqual((first as any).playerId);
    expect(rm.players(code)).toHaveLength(1);
    expect(rm.players(code)[0].connected).toBe(true);
  });

  it("errors when joining a missing room", () => {
    const r = rm.join("ZZZZ", "Joe");
    expect(r).toEqual({ ok: false, code: "no_room", message: expect.any(String) });
  });
});
