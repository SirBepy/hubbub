import type { ActionContext, GameLogic, PlayerInfo } from "./types.js";

export class GameInstance<State, Action> {
  private state: State;

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

  /** Epoch ms of the next scheduled state change, or null if the game has none pending. */
  nextDeadline(): number | null {
    return this.logic.nextDeadline ? (this.logic.nextDeadline(this.state) ?? null) : null;
  }

  /** Advances state past a deadline. Returns false (no-op) if the game has no timeout hook or none is due yet. */
  checkTimeout(now: number): boolean {
    if (!this.logic.onTimeout) return false;
    const deadline = this.nextDeadline();
    if (deadline === null || now < deadline) return false;
    this.state = this.logic.onTimeout(this.state, now);
    return true;
  }
}
