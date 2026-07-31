import type { ZodType } from "zod";

export interface PlayerInfo {
  id: string;
  name: string;
}

export interface GameMeta {
  name: string;
  minPlayers: number;
  maxPlayers?: number;
  category?: string;
  /** Indexes into protocol's PLAYER_COLOR_NAMES for the game's two roles, e.g. [X, O]. */
  identityColors?: [number, number];
}

export interface GameResult {
  winnerId: string | null;
  isDraw: boolean;
}

export interface GameLogic<State, Action> {
  meta: GameMeta;
  actionSchema: ZodType<Action>;
  init(players: PlayerInfo[]): State;
  onAction(state: State, playerId: string, action: Action): State;
  onPlayersChanged(state: State, players: PlayerInfo[]): State;
  /** null while still playing; { winnerId: null, isDraw: true } on a draw. */
  result?(state: State): GameResult | null;
}
