import { describe, it, expect } from "vitest";
import { ROOM_CODE_LENGTH } from "@hubbub/protocol";
import type { GameCatalog, TokenSource } from "@hubbub/relay";
import { RoomManager } from "./rooms.js";

// Per-room relay logic (join, host, lobby, config, launch) is now @hubbub/relay's Room and is
// covered by packages/relay/src/room.test.ts - this only tests the multi-room index apps/server
// still owns: code allocation and the code -> Room lookup.
const catalog: GameCatalog = { summaries: [], settingsSchema: () => null, setup: async () => undefined };
let n = 0;
const tokens: TokenSource = { next: () => `tok${n++}` };

describe("RoomManager", () => {
  it("creates a retrievable room in lobby mode", () => {
    const rm = new RoomManager(catalog, tokens);
    const code = rm.createRoom();
    expect(code).toHaveLength(ROOM_CODE_LENGTH);
    expect(rm.get(code)?.snapshot().mode).toBe("lobby");
    expect(rm.get(code)?.snapshot().hostId).toBeNull();
  });

  it("allocates distinct codes for distinct rooms", () => {
    const rm = new RoomManager(catalog, tokens);
    const a = rm.createRoom();
    const b = rm.createRoom();
    expect(a).not.toBe(b);
    expect(rm.get(a)).not.toBe(rm.get(b));
  });

  it("reports existence via has()", () => {
    const rm = new RoomManager(catalog, tokens);
    const code = rm.createRoom();
    expect(rm.has(code)).toBe(true);
    expect(rm.has("ZZZZ")).toBe(false);
  });

  it("returns undefined from get() for a missing code", () => {
    const rm = new RoomManager(catalog, tokens);
    expect(rm.get("ZZZZ")).toBeUndefined();
  });
});
