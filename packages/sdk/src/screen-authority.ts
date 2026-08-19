import { GameInstance } from "./runtime.js";
import type { GameLogic, PlayerInfo } from "./types.js";

export interface GameAuthority {
  /** Constructs a fresh GameInstance (calls the logic's init()) and reports its initial state. */
  launch(logic: GameLogic<any, any>, players: PlayerInfo[], setupData: unknown, now: number): void;
  /** Applies a forwarded action; no-ops (no onState call) if the action fails schema validation. */
  action(playerId: string, payload: unknown, now: number): void;
  /** Drops the current instance and cancels its pending timeout. */
  reset(): void;
}

/** Screen-authoritative reducer driver (design spec Phase B, "Authority"): owns the
 * GameInstance and its own timeout scheduling via nextDeadline/checkTimeout, reporting every
 * resulting state through onState. Transport-agnostic - callers (apps/screen, server tests
 * standing in for a screen) decide how to relay onState's payload over the wire. */
// Floor for the re-arm delay: a deadline at or before now (stale, or a game that never
// clears it in onTimeout) must not collapse to a 0ms setTimeout, which recurses
// synchronously and pins the host's main thread. One frame at 60fps is the floor.
const MIN_TIMER_MS = 16;

export function createGameAuthority(onState: (state: unknown) => void): GameAuthority {
  let inst: GameInstance<any, any> | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function clearTimer() {
    if (timer !== null) { clearTimeout(timer); timer = null; }
  }
  function scheduleTimer() {
    clearTimer();
    const deadline = inst?.nextDeadline();
    if (deadline === null || deadline === undefined) return;
    timer = setTimeout(() => {
      if (inst?.checkTimeout(Date.now())) onState(inst.get());
      scheduleTimer();
    }, Math.max(MIN_TIMER_MS, deadline - Date.now()));
  }

  return {
    launch(logic, players, setupData, now) {
      clearTimer();
      inst = new GameInstance(logic, players, setupData, now);
      onState(inst.get());
      scheduleTimer();
    },
    action(playerId, payload, now) {
      if (!inst?.applyAction(playerId, payload, now)) return;
      onState(inst.get());
      scheduleTimer();
    },
    reset() {
      clearTimer();
      inst = null;
    },
  };
}
