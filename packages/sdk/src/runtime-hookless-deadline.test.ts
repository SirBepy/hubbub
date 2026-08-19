import { describe, it, expect } from "vitest";
import { z } from "zod";
import { GameInstance } from "./runtime.js";
import type { GameLogic } from "./types.js";

interface State { tag: string }
interface Action {}

// Declares a fixed past deadline but no onTimeout - the malformed/hostile shape from todo 38.
const staleNoHook: GameLogic<State, Action> = {
  meta: { name: "StaleNoHook", minPlayers: 1 },
  actionSchema: z.object({}),
  init: () => ({ tag: "init" }),
  onAction: (s) => s,
  onPlayersChanged: (s) => s,
  nextDeadline: () => 1000,
};

describe("GameInstance hookless past-deadline masking", () => {
  it("stops reporting a hookless deadline as pending once checkTimeout has surfaced it", () => {
    const gi = new GameInstance(staleNoHook, [{ id: "p1", name: "Joe" }]);
    expect(gi.nextDeadline()).toBe(1000); // due, not yet surfaced

    expect(gi.checkTimeout(2000)).toBe(false); // no onTimeout - no-op, but marks it surfaced
    expect(gi.nextDeadline()).toBeNull(); // masked now - a caller's re-arm loop can stop

    expect(gi.checkTimeout(3000)).toBe(false); // stays a safe no-op on further calls
  });
});
