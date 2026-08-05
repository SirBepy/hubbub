import type { ZodType } from "zod";

export interface PlayerInfo {
  id: string;
  name: string;
}

/** Protocol's wire Player carries the same shape; kept independent to avoid a protocol->sdk dep. */
export interface DisplayPlayer {
  id: string;
  name: string;
  colorId: number;
  emoji: string;
  connected: boolean;
}

export interface GameMeta {
  name: string;
  minPlayers: number;
  maxPlayers?: number;
  category?: string;
  /** One-line pitch shown as hero body copy on the lobby. */
  description?: string;
  /** Indexes into protocol's PLAYER_COLOR_NAMES for the game's two roles, e.g. [X, O]. */
  identityColors?: [number, number];
  /** width/height. Omit for fluid layout (default); set only when the game needs a fixed
   * frame (3D, a racer) - the screen app letterboxes to this ratio. Never a pixel size. */
  aspectRatio?: number;
}

export interface GameResult {
  winnerId: string | null;
  isDraw: boolean;
}

export interface SettingsFieldOption {
  value: string;
  label: string;
}

/** One row of a pre-game config schema. Values are always strings - numbers are discrete
 * choice options (D-pad drivable), never free numeric input. */
export interface SettingsField {
  key: string;
  label: string;
  type: "choice" | "text";
  /** Required when type is "choice"; cycled left/right via configAdjust. */
  options?: SettingsFieldOption[];
  default: string;
  placeholder?: string;
  /** Field only visible (and skipped by cursor/cycle) when values[field] === value. */
  showIf?: { field: string; value: string };
}

export type SettingsSchema = SettingsField[];

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
