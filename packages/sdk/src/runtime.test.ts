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

// A timed game: setupData seeds the count, onAction reads the server clock, and the round
// auto-advances via nextDeadline/onTimeout once a deadline passes.
interface TimedState { count: number; deadline: number | null; lastNow: number | null }
interface TimedAction { by: number }

const timed: GameLogic<TimedState, TimedAction> = {
  meta: { name: "Timed", minPlayers: 1 },
  actionSchema: z.object({ by: z.number() }),
  setup: async (options) => ({ seedCount: (options as { seedCount?: number })?.seedCount ?? 0 }),
  init: (_players, setupData) => ({
    count: (setupData as { seedCount: number } | undefined)?.seedCount ?? 0,
    deadline: null,
    lastNow: null,
  }),
  onAction: (s, _playerId, a, ctx) => ({ ...s, count: s.count + a.by, deadline: (ctx?.now ?? 0) + 1000, lastNow: ctx?.now ?? null }),
  onPlayersChanged: (s) => s,
  nextDeadline: (s) => s.deadline,
  onTimeout: (s, now) => ({ ...s, count: 0, deadline: null, lastNow: now }),
};

describe("GameInstance setup data and timestamps", () => {
  it("threads setupData from the constructor into init", () => {
    const gi = new GameInstance(timed, [{ id: "p1", name: "Joe" }], { seedCount: 7 });
    expect(gi.get().count).toBe(7);
  });

  it("passes the injected now into init's ctx via an explicit ctx-carrying init", () => {
    const withClock: GameLogic<TimedState, TimedAction> = {
      ...timed,
      init: (_players, setupData, ctx) => ({
        count: (setupData as { seedCount: number } | undefined)?.seedCount ?? 0,
        deadline: null,
        lastNow: ctx?.now ?? null,
      }),
    };
    const gi = new GameInstance(withClock, [{ id: "p1", name: "Joe" }], undefined, 5000);
    expect(gi.get().lastNow).toBe(5000);
  });

  it("passes the applyAction now through as ctx.now", () => {
    const gi = new GameInstance(timed, [{ id: "p1", name: "Joe" }]);
    gi.applyAction("p1", { by: 1 }, 1000);
    expect(gi.get().lastNow).toBe(1000);
    expect(gi.get().deadline).toBe(2000);
  });

  it("nextDeadline reflects the game's own deadline, null when none pending", () => {
    const gi = new GameInstance(timed, [{ id: "p1", name: "Joe" }]);
    expect(gi.nextDeadline()).toBeNull();
    gi.applyAction("p1", { by: 1 }, 1000);
    expect(gi.nextDeadline()).toBe(2000);
  });

  it("checkTimeout no-ops before the deadline and advances state once past it", () => {
    const gi = new GameInstance(timed, [{ id: "p1", name: "Joe" }]);
    gi.applyAction("p1", { by: 1 }, 1000); // deadline = 2000
    expect(gi.checkTimeout(1999)).toBe(false);
    expect(gi.get().count).toBe(1);
    expect(gi.checkTimeout(2000)).toBe(true);
    expect(gi.get().count).toBe(0);
    expect(gi.nextDeadline()).toBeNull();
  });

  it("checkTimeout is a safe no-op for games without a timeout hook", () => {
    const gi = new GameInstance(counter, [{ id: "p1", name: "Joe" }]);
    expect(gi.checkTimeout(999999)).toBe(false);
  });
});
