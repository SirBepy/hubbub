import type { ActionContext, GameLogic, PlayerInfo } from "./types.js";

export class GameInstance<State, Action> {
  private state: State;
  // Deadline last surfaced by nextDeadline() for a game with no onTimeout hook. A hookless
  // game can never advance past its own deadline, so once seen once it is masked to null -
  // otherwise screen-authority's scheduler would re-arm against it forever.
  private surfacedStaleDeadline: number | null = null;

  constructor(
    private logic: GameLogic<State, Action>,
    players: PlayerInfo[],
    setupData?: unknown,
    now?: number
  ) {
    this.state = logic.init(players, setupData, now !== undefined ? { now } : undefined);
  }

  get(): State {
    return this.state;
  }

  playersChanged(players: PlayerInfo[]): void {
    this.state = this.logic.onPlayersChanged(this.state, players);
  }

  applyAction(playerId: string, rawPayload: unknown, now?: number): boolean {
    const parsed = this.logic.actionSchema.safeParse(rawPayload);
    if (!parsed.success) return false;
    const ctx: ActionContext | undefined = now !== undefined ? { now } : undefined;
    this.state = this.logic.onAction(this.state, playerId, parsed.data, ctx);
    return true;
  }

  /** Epoch ms of the next scheduled state change, or null if the game has none pending.
   * A hookless deadline already surfaced once by checkTimeout reads as null here, since it
   * can never produce a state change. */
  nextDeadline(): number | null {
    const deadline = this.logic.nextDeadline ? (this.logic.nextDeadline(this.state) ?? null) : null;
    if (deadline !== null && !this.logic.onTimeout && deadline === this.surfacedStaleDeadline) return null;
    return deadline;
  }

  /** Advances state past a deadline. Returns false (no-op) if the game has no timeout hook
   * or none is due yet; a hookless due deadline is marked surfaced so nextDeadline() stops
   * reporting it, rather than leaving the caller's re-arm loop with nothing to advance. */
  checkTimeout(now: number): boolean {
    const deadline = this.nextDeadline();
    if (deadline === null || now < deadline) return false;
    if (!this.logic.onTimeout) {
      this.surfacedStaleDeadline = deadline;
      return false;
    }
    this.state = this.logic.onTimeout(this.state, now);
    return true;
  }
}
