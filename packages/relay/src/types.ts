import type { ClientMessage, GameSummary, ServerMessage } from "@hubbub/protocol";

export type { ClientMessage, ServerMessage };

export interface RelayPlayerInfo {
  id: string;
  name: string;
}

export interface RelaySettingsFieldOption {
  value: string;
  label: string;
}

/** Structural subset of sdk's SettingsField - relay only needs these to drive config-phase
 * cursor/cycle logic, so it stays independent of @hubbub/sdk (workerd import-graph hygiene). */
export interface RelaySettingsField {
  key: string;
  type: "choice" | "text";
  options?: RelaySettingsFieldOption[];
  default: string;
  showIf?: { field: string; value: string };
}

/** Game metadata/setup, injected: a Worker's registry and a Node registry differ, and setup()
 * may do network I/O whose implementation the relay core must never know about. */
export interface GameCatalog {
  summaries: GameSummary[];
  settingsSchema(gameId: string): RelaySettingsField[] | null;
  setup(gameId: string, options: unknown, players: RelayPlayerInfo[]): Promise<unknown>;
}

/** Id/token generation, injected so the core never touches node:crypto and stays deterministic
 * in tests. */
export interface TokenSource {
  next(): string;
}

/** Symbolic destination - the caller owns the connId -> socket mapping, the relay never sees a
 * socket. The room already knows its own screenConnId, so screen-targeted messages resolve to
 * "conn" directly rather than making the caller re-derive which connId is the screen. */
export type Outbound =
  | { to: "all"; msg: ServerMessage }
  | { to: "conn"; connId: string; msg: ServerMessage };
