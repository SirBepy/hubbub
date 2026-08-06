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

  it("newRoomCode's byte-to-alphabet mapping is unbiased (256 % 32 === 0, no modulo bias)", () => {
    const counts = new Map<string, number>();
    for (const ch of CODE_ALPHABET) counts.set(ch, 0);
    const samples = 20_000;
    let produced = 0;
    while (produced < samples) {
      for (const ch of newRoomCode()) {
        counts.set(ch, (counts.get(ch) ?? 0) + 1);
        produced++;
      }
    }
    const expected = produced / CODE_ALPHABET.length;
    // Generous +/-40% band (~10 standard deviations for a true-uniform binomial at this sample
    // size): a gross bias or indexing bug trips it, normal random variance never does.
    for (const count of counts.values()) {
      expect(count).toBeGreaterThan(expected * 0.6);
      expect(count).toBeLessThan(expected * 1.4);
    }
  });
});
