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

/** Server clock at the moment something happened. Games read `now` from here, never call Date.now() themselves. */
export interface ActionContext {
  now: number;
}

export interface GameLogic<State, Action> {
  meta: GameMeta;
  actionSchema: ZodType<Action>;
  /** Awaited by the server before init when present - e.g. a Node-side fetch. Raw, client-supplied options. */
  setup?(options: unknown, players: PlayerInfo[]): Promise<unknown>;
  init(players: PlayerInfo[], setupData?: unknown, ctx?: ActionContext): State;
  onAction(state: State, playerId: string, action: Action, ctx?: ActionContext): State;
  onPlayersChanged(state: State, players: PlayerInfo[]): State;
  /** null while still playing; { winnerId: null, isDraw: true } on a draw. */
  result?(state: State): GameResult | null;
  /** Epoch ms of the next state change the server should force, or null/undefined if none pending. */
  nextDeadline?(state: State): number | null;
  /** Invoked by the server runtime once `now` passes nextDeadline(state); never called from game code itself. */
  onTimeout?(state: State, now: number): State;
}
