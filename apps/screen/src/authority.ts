import type { DisplayPlayer, GameResult } from "@hubbub/sdk";

/** What the screen needs from a reducer driver, either side of the sandbox. `gameId` is a
 * parameter rather than a `GameLogic` because the logic never crosses the boundary. */
export interface ScreenAuthority {
  launch(gameId: string, players: DisplayPlayer[], setupData: unknown, now: number): void;
  action(playerId: string, payload: unknown, now: number): void;
  playersChanged(players: DisplayPlayer[]): void;
  reset(): void;
}

export interface AuthorityCallbacks {
  onState(gameId: string, state: unknown): void;
  /** Null while still playing. Derived from the logic directly, or reported by the frame. */
  onResult(result: GameResult | null): void;
  onFailure(reason: string): void;
}
