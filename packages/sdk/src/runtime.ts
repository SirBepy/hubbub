import type { GameLogic, PlayerInfo } from "./types.js";

export class GameInstance<State, Action> {
  private state: State;

  constructor(
    private logic: GameLogic<State, Action>,
    players: PlayerInfo[]
  ) {
    this.state = logic.init(players);
  }

  get(): State {
    return this.state;
  }

  playersChanged(players: PlayerInfo[]): void {
    this.state = this.logic.onPlayersChanged(this.state, players);
  }

  applyAction(playerId: string, rawPayload: unknown): boolean {
    const parsed = this.logic.actionSchema.safeParse(rawPayload);
    if (!parsed.success) return false;
    this.state = this.logic.onAction(this.state, playerId, parsed.data);
    return true;
  }
}
