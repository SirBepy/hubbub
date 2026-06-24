import type { ZodType } from "zod";

export interface PlayerInfo {
  id: string;
  name: string;
}

export interface GameMeta {
  name: string;
  minPlayers: number;
  maxPlayers?: number;
}

export interface GameLogic<State, Action> {
  meta: GameMeta;
  actionSchema: ZodType<Action>;
  init(players: PlayerInfo[]): State;
  onAction(state: State, playerId: string, action: Action): State;
  onPlayersChanged(state: State, players: PlayerInfo[]): State;
}
