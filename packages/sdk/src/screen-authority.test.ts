import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { z } from "zod";
import { createGameAuthority } from "./screen-authority.js";
import type { GameLogic } from "./types.js";

interface State { tick: number }
interface Action {}

// A deadline stuck in the past with no onTimeout hook - reproduces todo 38: a hostile or
// buggy game bundle declaring this pins the screen's main thread in a 0ms re-arm loop.
const staleDeadlineGame: GameLogic<State, Action> = {
  meta: { name: "Stale", minPlayers: 1 },
  actionSchema: z.object({}),
  init: () => ({ tick: 0 }),
  onAction: (s) => s,
  onPlayersChanged: (s) => s,
  nextDeadline: () => Date.now() - 5000,
};

const rosterGame: GameLogic<State & { playerIds: string[] }, Action> = {
  meta: { name: "Roster", minPlayers: 1 },
  actionSchema: z.object({}),
  init: () => ({ tick: 0, playerIds: [] }),
  onAction: (s) => s,
  onPlayersChanged: (s, players) => ({ ...s, playerIds: players.map((p) => p.id) }),
};

describe("createGameAuthority.playersChanged", () => {
  it("forwards a mid-game roster change to onPlayersChanged and broadcasts via onState", () => {
    const states: unknown[] = [];
    const authority = createGameAuthority((s) => states.push(s));
    authority.launch(rosterGame, [{ id: "p1", name: "Joe" }], undefined, Date.now());

    authority.playersChanged([{ id: "p1", name: "Joe" }, { id: "p2", name: "Ann" }]);

    expect(states.at(-1)).toEqual({ tick: 0, playerIds: ["p1", "p2"] });
  });

  it("no-ops when no instance is live", () => {
    const onState = vi.fn();
    const authority = createGameAuthority(onState);
    authority.playersChanged([{ id: "p1", name: "Joe" }]);
    expect(onState).not.toHaveBeenCalled();
  });
});

describe("createGameAuthority re-arm floor and termination", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("floors the first re-arm instead of scheduling a 0ms timer", () => {
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    const authority = createGameAuthority(() => {});
    authority.launch(staleDeadlineGame, [{ id: "p1", name: "Joe" }], undefined, Date.now());

    const delays = setTimeoutSpy.mock.calls.map((call) => call[1] ?? 0);
    expect(delays.length).toBeGreaterThan(0);
    expect(delays.every((d) => d > 0)).toBe(true);
  });

  it("stops re-arming after surfacing a hookless past deadline once", () => {
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    const authority = createGameAuthority(() => {});
    authority.launch(staleDeadlineGame, [{ id: "p1", name: "Joe" }], undefined, Date.now());

    vi.advanceTimersToNextTimer(); // fires the floored re-arm, which surfaces and masks the deadline
    const callsAfterFirstFire = setTimeoutSpy.mock.calls.length;

    vi.advanceTimersByTime(10_000); // nothing left pending - count must not grow if the loop truly stopped
    expect(setTimeoutSpy.mock.calls.length).toBe(callsAfterFirstFire);
  });
});
