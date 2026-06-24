import { describe, it, expect } from "vitest";
import { z } from "zod";
import { GameInstance } from "./runtime.js";
import type { GameLogic } from "./types.js";

// Minimal game: a shared counter only the first player may increment.
interface CounterState { count: number; owner: string | null }
interface CounterAction { by: number }

const counter: GameLogic<CounterState, CounterAction> = {
  meta: { name: "Counter", minPlayers: 1 },
  actionSchema: z.object({ by: z.number() }),
  init: (players) => ({ count: 0, owner: players[0]?.id ?? null }),
  onAction: (s, playerId, a) =>
    playerId === s.owner ? { ...s, count: s.count + a.by } : s,
  onPlayersChanged: (s, players) =>
    s.owner ? s : { ...s, owner: players[0]?.id ?? null },
};

describe("GameInstance", () => {
  it("initializes state from logic", () => {
    const gi = new GameInstance(counter, [{ id: "p1", name: "Joe" }]);
    expect(gi.get()).toEqual({ count: 0, owner: "p1" });
  });

  it("applies a schema-valid action from the owner", () => {
    const gi = new GameInstance(counter, [{ id: "p1", name: "Joe" }]);
    expect(gi.applyAction("p1", { by: 5 })).toBe(true);
    expect(gi.get().count).toBe(5);
  });

  it("rejects a schema-invalid payload without mutating state", () => {
    const gi = new GameInstance(counter, [{ id: "p1", name: "Joe" }]);
    expect(gi.applyAction("p1", { by: "lots" })).toBe(false);
    expect(gi.get().count).toBe(0);
  });

  it("lets the game no-op a rule-invalid action (non-owner)", () => {
    const gi = new GameInstance(counter, [{ id: "p1", name: "Joe" }]);
    expect(gi.applyAction("p2", { by: 5 })).toBe(true); // schema ok
    expect(gi.get().count).toBe(0); // logic ignored it
  });
});
