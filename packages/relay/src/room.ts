import type { Identity } from "@hubbub/protocol";
import type {
  ClientMessage,
  GameCatalog,
  Outbound,
  RelaySettingsField,
  ServerMessage,
  TokenSource,
} from "./types.js";

export type RoomMode = "lobby" | "configuring" | "in-game";

interface StoredPlayer {
  id: string;
  name: string;
  colorId: number;
  emoji: string;
  connected: boolean;
  token: string;
}
interface RoomConfig {
  gameId: string;
  cursorIndex: number;
  values: Record<string, string>;
}
interface ConnInfo {
  role: "screen" | "controller";
  playerId?: string;
}
interface LastGameState {
  gameId: string;
  state: unknown;
}

/** Every field here must be JSON-safe: a Durable Object using WebSocket Hibernation is evicted
 * from memory between messages, so this is the only thing that survives - no Map/Set, no
 * live socket handles. */
export interface RoomSnapshot {
  code: string;
  players: Record<string, StoredPlayer>;
  hostId: string | null;
  mode: RoomMode;
  currentGameId: string | null;
  cursorIndex: number;
  suggestions: Record<string, string>; // playerId -> gameId (latest wins)
  config: RoomConfig | null;
  lastOptions: unknown;
  lastGameState: LastGameState | null;
  connections: Record<string, ConnInfo>;
  screenConnId: string | null;
}

function defaultConfigValues(schema: RelaySettingsField[]): Record<string, string> {
  const values: Record<string, string> = {};
  for (const f of schema) values[f.key] = f.default;
  return values;
}
function visibleFields(schema: RelaySettingsField[], values: Record<string, string>): RelaySettingsField[] {
  return schema.filter((f) => !f.showIf || values[f.showIf.field] === f.showIf.value);
}

/** One room's relay state and message handling - the whole point of this class is that a Node
 * server and a Cloudflare Durable Object can both drive the exact same logic through
 * handleMessage/handleDisconnect, identified only by opaque connId strings. */
export class Room {
  private data: RoomSnapshot;

  private constructor(
    private readonly catalog: GameCatalog,
    private readonly tokens: TokenSource,
    snapshot: RoomSnapshot,
  ) {
    this.data = snapshot;
  }

  static create(code: string, catalog: GameCatalog, tokens: TokenSource): Room {
    return new Room(catalog, tokens, {
      code,
      players: {},
      hostId: null,
      mode: "lobby",
      currentGameId: null,
      cursorIndex: 0,
      suggestions: {},
      config: null,
      lastOptions: undefined,
      lastGameState: null,
      connections: {},
      screenConnId: null,
    });
  }

  /** Reconstructs a room from a previously-taken snapshot() - the DO rehydration path. */
  static fromSnapshot(snapshot: RoomSnapshot, catalog: GameCatalog, tokens: TokenSource): Room {
    return new Room(catalog, tokens, snapshot);
  }

  /** Plain JSON-safe value; round-tripping it through JSON.stringify/parse and passing the
   * result to fromSnapshot() must reproduce identical behaviour. */
  snapshot(): RoomSnapshot {
    return JSON.parse(JSON.stringify(this.data));
  }

  /** Connections currently attached (sent attachScreen or joinRoom) - the caller's socket set
   * for "to: all" should be exactly these ids, never every raw-connected socket. */
  connIds(): string[] {
    return Object.keys(this.data.connections);
  }
  currentScreenConnId(): string | null {
    return this.data.screenConnId;
  }

  async handleMessage(connId: string, msg: ClientMessage, now: number): Promise<Outbound[]> {
    const conn = this.data.connections[connId];

    if (msg.t === "attachScreen") {
      this.data.connections[connId] = { role: "screen" };
      this.data.screenConnId = connId;
      return [
        { to: "conn", connId, msg: { t: "roomCreated", code: this.data.code } },
        ...this.broadcastRoomState(),
      ];
    }

    if (msg.t === "joinRoom") {
      const result = this.join({ name: msg.name, colorId: msg.colorId, emoji: msg.emoji }, msg.token);
      if (!result.ok) return [{ to: "conn", connId, msg: { t: "error", code: result.code, message: result.message } }];
      this.data.connections[connId] = { role: "controller", playerId: result.playerId };
      const out: Outbound[] = [
        { to: "conn", connId, msg: { t: "joined", playerId: result.playerId, token: result.token } },
        ...this.broadcastRoomState(),
      ];
      const cached = this.data.lastGameState;
      if (this.data.mode === "in-game" && cached) {
        out.push({ to: "conn", connId, msg: { t: "gameState", gameId: cached.gameId, state: cached.state } });
      }
      return out;
    }

    if (msg.t === "setIdentity") {
      if (!conn?.playerId) return [];
      const p = this.data.players[conn.playerId];
      if (p) { p.name = msg.name; p.colorId = msg.colorId; p.emoji = msg.emoji; }
      return this.broadcastRoomState();
    }

    if (msg.t === "lobbyNav" || msg.t === "lobbyFocus" || msg.t === "lobbyConfirm" || msg.t === "returnToLobby" || msg.t === "transferHost" || msg.t === "rematch") {
      if (!conn?.playerId || this.data.hostId !== conn.playerId) return [];
      const count = this.catalog.summaries.length;
      if (msg.t === "lobbyNav") {
        if (this.data.mode !== "lobby") return [];
        this.moveCursor(msg.dir, count);
        return this.broadcastRoomState();
      }
      if (msg.t === "lobbyFocus") {
        if (this.data.mode !== "lobby") return [];
        this.focusCursor(msg.index, count);
        return this.broadcastRoomState();
      }
      if (msg.t === "lobbyConfirm") {
        if (this.data.mode !== "lobby") return [];
        const summary = this.catalog.summaries[this.data.cursorIndex];
        if (!summary) return [];
        return this.launch(summary.id, msg.options, connId, now);
      }
      if (msg.t === "returnToLobby") {
        this.data.lastGameState = null;
        this.data.mode = "lobby";
        this.data.currentGameId = null;
        this.data.suggestions = {};
        return this.broadcastRoomState();
      }
      if (msg.t === "transferHost") {
        const target = this.data.players[msg.toPlayerId];
        if (!target?.connected) return [];
        this.data.hostId = msg.toPlayerId;
        return this.broadcastRoomState();
      }
      // rematch
      if (this.data.mode !== "in-game" || !this.data.currentGameId) return [];
      const summary = this.catalog.summaries.find((s) => s.id === this.data.currentGameId);
      if (!summary) return [];
      return this.launch(summary.id, this.data.lastOptions, connId, now);
    }

    if (msg.t === "suggestGame") {
      if (!conn?.playerId || this.data.mode !== "lobby") return [];
      if (!this.catalog.summaries.some((s) => s.id === msg.gameId)) return [];
      if (!this.data.players[conn.playerId]) return [];
      if (this.data.suggestions[conn.playerId] === msg.gameId) delete this.data.suggestions[conn.playerId];
      else this.data.suggestions[conn.playerId] = msg.gameId;
      return this.broadcastRoomState();
    }

    if (msg.t === "configStart") {
      if (!conn?.playerId || this.data.hostId !== conn.playerId) return [];
      if (this.data.mode !== "lobby") return [];
      const summary = this.catalog.summaries[this.data.cursorIndex];
      if (!summary) return [];
      const schema = this.catalog.settingsSchema(summary.id);
      if (!schema) return this.launch(summary.id, undefined, connId, now);
      this.data.mode = "configuring";
      this.data.config = { gameId: summary.id, cursorIndex: 0, values: defaultConfigValues(schema) };
      return this.broadcastRoomState();
    }

    if (msg.t === "configCursor" || msg.t === "configAdjust" || msg.t === "configSet" || msg.t === "configConfirm" || msg.t === "configCancel") {
      if (!conn?.playerId || this.data.hostId !== conn.playerId) return [];
      if (this.data.mode !== "configuring" || !this.data.config) return [];
      const cfg = this.data.config;
      const schema = this.catalog.settingsSchema(cfg.gameId) ?? [];

      if (msg.t === "configCursor") {
        const fieldCount = visibleFields(schema, cfg.values).length;
        if (fieldCount <= 0) return [];
        const delta = msg.dir === "up" ? -1 : 1;
        cfg.cursorIndex = Math.min(fieldCount - 1, Math.max(0, cfg.cursorIndex + delta));
        return this.broadcastRoomState();
      }
      if (msg.t === "configAdjust") {
        const field = schema.find((f) => f.key === msg.field && f.type === "choice");
        if (!field?.options?.length) return [];
        const curIdx = Math.max(0, field.options.findIndex((o) => o.value === cfg.values[msg.field]));
        const delta = msg.dir === "left" ? -1 : 1;
        const opts = field.options;
        const nextIdx = ((curIdx + delta) % opts.length + opts.length) % opts.length;
        cfg.values[msg.field] = opts[nextIdx].value;
        const fieldCount = visibleFields(schema, cfg.values).length;
        if (fieldCount > 0) cfg.cursorIndex = Math.min(fieldCount - 1, Math.max(0, cfg.cursorIndex));
        return this.broadcastRoomState();
      }
      if (msg.t === "configSet") {
        const field = schema.find((f) => f.key === msg.field && f.type === "text");
        if (!field) return [];
        cfg.values[msg.field] = msg.value;
        return this.broadcastRoomState();
      }
      if (msg.t === "configConfirm") {
        return this.launch(cfg.gameId, { ...cfg.values }, connId, now);
      }
      // configCancel
      this.data.mode = "lobby";
      this.data.config = null;
      return this.broadcastRoomState();
    }

    if (msg.t === "action") {
      if (!conn?.playerId || this.data.mode !== "in-game" || !this.data.screenConnId) return [];
      return [{ to: "conn", connId: this.data.screenConnId, msg: { t: "gameAction", playerId: conn.playerId, payload: msg.payload, now } }];
    }

    if (msg.t === "gameStatePush") {
      // The obvious forgery hole: only the room's own screen connection may push state, and
      // only for the game currently in play - not a controller, and not a stale/superseded launch.
      if (conn?.role !== "screen" || this.data.screenConnId !== connId) return [];
      if (this.data.mode !== "in-game" || this.data.currentGameId !== msg.gameId) return [];
      this.data.lastGameState = { gameId: msg.gameId, state: msg.state };
      return [{ to: "all", msg: { t: "gameState", gameId: msg.gameId, state: msg.state } }];
    }

    return [];
  }

  handleDisconnect(connId: string): Outbound[] {
    const conn = this.data.connections[connId];
    if (!conn) return [];
    delete this.data.connections[connId];
    if (conn.role === "screen") {
      if (this.data.screenConnId === connId) this.data.screenConnId = null;
      return [];
    }
    if (conn.playerId) {
      this.setConnected(conn.playerId, false);
      delete this.data.suggestions[conn.playerId];
      return this.broadcastRoomState();
    }
    return [];
  }

  private async launch(gameId: string, options: unknown, notifyConnId: string | undefined, now: number): Promise<Outbound[]> {
    const summary = this.catalog.summaries.find((s) => s.id === gameId);
    if (!summary) return [];
    const players = Object.values(this.data.players).filter((p) => p.connected).map((p) => ({ id: p.id, name: p.name }));
    if (players.length < summary.minPlayers) return [];
    let setupData: unknown;
    try {
      setupData = await this.catalog.setup(gameId, options, players);
    } catch (err) {
      if (!notifyConnId) return [];
      return [{ to: "conn", connId: notifyConnId, msg: { t: "error", code: "setup_failed", message: err instanceof Error ? err.message : "Game setup failed" } }];
    }
    this.data.lastOptions = options;
    this.data.lastGameState = null;
    this.data.mode = "in-game";
    this.data.currentGameId = gameId;
    this.data.config = null;
    this.data.suggestions = {};
    const out = this.broadcastRoomState();
    if (this.data.screenConnId) {
      out.push({ to: "conn", connId: this.data.screenConnId, msg: { t: "gameLaunch", gameId, players, setupData, now } });
    }
    return out;
  }

  private join(identity: Identity, token?: string): { ok: true; playerId: string; token: string } | { ok: false; code: "no_room"; message: string } {
    if (token) {
      for (const p of Object.values(this.data.players)) {
        if (p.token === token) {
          p.name = identity.name; p.colorId = identity.colorId; p.emoji = identity.emoji;
          p.connected = true;
          this.ensureHost();
          return { ok: true, playerId: p.id, token: p.token };
        }
      }
    }
    const id = this.tokens.next();
    const tok = this.tokens.next();
    this.data.players[id] = { id, name: identity.name, colorId: identity.colorId, emoji: identity.emoji, connected: true, token: tok };
    this.ensureHost();
    return { ok: true, playerId: id, token: tok };
  }

  private setConnected(playerId: string, connected: boolean): void {
    const p = this.data.players[playerId];
    if (!p) return;
    p.connected = connected;
    if (!connected && this.data.hostId === playerId) this.data.hostId = this.oldestConnected();
    else if (connected) this.ensureHost();
  }

  private ensureHost(): void {
    if (this.data.hostId && this.data.players[this.data.hostId]?.connected) return;
    this.data.hostId = this.oldestConnected();
  }
  private oldestConnected(): string | null {
    for (const p of Object.values(this.data.players)) if (p.connected) return p.id;
    return null;
  }

  private moveCursor(dir: "up" | "down" | "left" | "right", count: number): void {
    if (count <= 0) return;
    const delta = dir === "left" || dir === "up" ? -1 : 1;
    this.data.cursorIndex = Math.min(count - 1, Math.max(0, this.data.cursorIndex + delta));
  }
  private focusCursor(index: number, count: number): void {
    if (count <= 0) return;
    this.data.cursorIndex = Math.min(count - 1, Math.max(0, index));
  }

  private broadcastRoomState(): Outbound[] {
    const msg: ServerMessage = {
      t: "roomState",
      players: Object.values(this.data.players).map(({ token, ...pub }) => pub),
      hostId: this.data.hostId,
      mode: this.data.mode,
      currentGameId: this.data.currentGameId,
      cursorIndex: this.data.cursorIndex,
      games: this.catalog.summaries,
      suggestions: Object.entries(this.data.suggestions).map(([playerId, gameId]) => ({ gameId, playerId })),
      config: this.data.config,
    };
    return [{ to: "all", msg }];
  }
}
