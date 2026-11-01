import { describe, it, expect } from "vitest";
import { GAME_LOGICS, SANDBOX_GAME_IDS } from "./logics.js";
import { GAME_CHUNKS } from "./lazy.js";

describe("games manifest", () => {
  it("registers the same game ids eagerly for the server and lazily for the browsers", () => {
    expect(new Set(Object.keys(GAME_CHUNKS))).toEqual(new Set(Object.keys(GAME_LOGICS)));
  });

  it("marks core games without a bundler as not sandbox-capable, and only registered games as capable", () => {
    expect(SANDBOX_GAME_IDS).not.toContain("ttt");
    expect(SANDBOX_GAME_IDS).not.toContain("uttt");
    for (const id of SANDBOX_GAME_IDS) expect(GAME_LOGICS, id).toHaveProperty(id);
  });

  it("gives every browser chunk all three loaders", () => {
    for (const [id, chunk] of Object.entries(GAME_CHUNKS)) {
      expect(typeof chunk.screen, id).toBe("function");
      expect(typeof chunk.controller, id).toBe("function");
      expect(typeof chunk.logic, id).toBe("function");
    }
  });
});
