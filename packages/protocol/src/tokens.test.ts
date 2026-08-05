import { describe, it, expect } from "vitest";
import { newToken, newRoomCode } from "./tokens.js";
import { ROOM_CODE_LENGTH } from "./constants.js";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

describe("tokens", () => {
  it("newToken returns a long unique string", () => {
    const a = newToken();
    const b = newToken();
    expect(a.length).toBeGreaterThanOrEqual(16);
    expect(a).not.toEqual(b);
  });

  it("newRoomCode returns ROOM_CODE_LENGTH chars from the unambiguous alphabet", () => {
    for (let i = 0; i < 50; i++) {
      const code = newRoomCode();
      expect(code).toHaveLength(ROOM_CODE_LENGTH);
      for (const ch of code) expect(CODE_ALPHABET).toContain(ch);
    }
  });
});
