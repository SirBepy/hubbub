import type { Identity } from "@hubbub/protocol";
import { hit, type RateLimitConfig } from "@hubbub/protocol/rate-limit";
import { noopLogger, type RelayLogger } from "./log.js";
import type {
  ClientMessage,
  GameCatalog,
  InputLegendEntry,
  Outbound,
  RelaySettingsField,
  ServerMessage,
  TokenSource,
} from "./types.js";

// A tickRateHz real-time game's screen loop runs at 60fps (CLAUDE.md's "60fps loop"), so 60/sec
// is the fastest plausible legitimate per-frame action rate. 120 over 1s doubles that ceiling -
// room for a stray double-send in one frame, nowhere near a flood (thousands/sec).
const ACTION_LIMIT: RateLimitConfig = { max: 120, windowMs: 1_000 };
// Same 60fps ceiling as ACTION_LIMIT; generous headroom for the taps/signaling limits below.
const GAME_STATE_PUSH_LIMIT: RateLimitConfig = { max: 120, windowMs: 1_000 };
const UI_ACTION_LIMIT: RateLimitConfig = { max: 20, windowMs: 1_000 };
const RTC_SIGNAL_LIMIT: RateLimitConfig = { max: 60, windowMs: 1_000 };

export type RoomMode = "lobby" | "configuring" | "in-game";

interface StoredPlayer {
  id: string;
  name: string;
  colorId: number;
  avatarId: string;
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
  // Set when the screen announces a sandboxed game died, cleared by the return beat or by any
  // fresh launch. Makes the two-beat failure exchange a handshake: a gameId alone cannot say
  // whether a delayed return belongs to the dead game or to a relaunch of that same game.
  failedGameId: string | null;
  connections: Record<string, ConnInfo>;
  // Legend published by the host's phone when a gamepad is bound to it. Stored with its author so
  // a host transfer or disconnect drops it rather than leaving the TV advertising a dead pad.
  inputLegend: { playerId: string; entries: InputLegendEntry[] } | null;
  screenConnId: string | null;
  // Minted on the first attachScreen (mirrors a player's join() token), null until then.
  // A later attachScreen must present it to reattach - see the handler below.
  screenToken: string | null;
}

// Guards against timing side channels on token comparison. Length is checked first (not
// secret - all real tokens share one fixed length), then every char is compared unconditionally.
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
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
  private msgHits: Record<string, Record<string, number[]>> = {};

  private constructor(
    private readonly catalog: GameCatalog,
    private readonly tokens: TokenSource,
    snapshot: RoomSnapshot,
    private readonly logger: RelayLogger,
  ) {
    this.data = snapshot;
  }

  static create(code: string, catalog: GameCatalog, tokens: TokenSource, logger: RelayLogger = noopLogger): Room {
    const room = new Room(catalog, tokens, {
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
      failedGameId: null,
      connections: {},
      inputLegend: null,
      screenConnId: null,
      screenToken: null,
    }, logger);
    logger.info(`[${code}] room created`);
    return room;
  }

  /** Reconstructs a room from a previously-taken snapshot() - the DO rehydration path. */
  static fromSnapshot(snapshot: RoomSnapshot, catalog: GameCatalog, tokens: TokenSource, logger: RelayLogger = noopLogger): Room {
    // A snapshot taken before inputLegend existed has no such key; default it rather than
    // letting a hibernated DO rehydrate with it undefined.
    return new Room(catalog, tokens, {
      ...snapshot,
      inputLegend: snapshot.inputLegend ?? null,
      failedGameId: snapshot.failedGameId ?? null,
    }, logger);
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

  private info(line: string): void {
    this.logger.info(`[${this.data.code}] ${line}`);
  }
  private debug(build: () => string): void {
    this.logger.debug(() => `[${this.data.code}] ${build()}`);
  }

  /** Reuses hit()'s shared sliding window per (message type, connId). true means over budget. */
  private limited(type: string, connId: string, now: number, cfg: RateLimitConfig): boolean {
    const perConn = this.msgHits[type] ?? (this.msgHits[type] = {});
    const recent = hit(perConn[connId] ?? [], now, cfg);
    perConn[connId] = recent;
    return recent.length > cfg.max;
  }

  async handleMessage(connId: string, msg: ClientMessage, now: number): Promise<Outbound[]> {
    const conn = this.data.connections[connId];

    if (msg.t === "attachScreen") {
      // A joined controller must not be able to flip its own connId into the screen role.
      if (conn?.playerId) return [{ to: "conn", connId, msg: { t: "error", code: "already_joined", message: "Connection already joined as a player" } }];
      // Mint on first attach (mirrors join()'s token); after that only the holder may (re)attach.
      let screenToken = this.data.screenToken;
      if (screenToken) {
        if (!msg.token || !timingSafeEqual(msg.token, screenToken)) {
          return [{ to: "conn", connId, msg: { t: "error", code: "invalid_screen_token", message: "Wrong or missing screen token" } }];
        }
      } else {
        screenToken = this.tokens.next();
        this.data.screenToken = screenToken;
      }
      if (this.data.screenConnId && this.data.screenConnId !== connId) delete this.data.connections[this.data.screenConnId];
      this.data.connections[connId] = { role: "screen" };
      this.data.screenConnId = connId;
      return [
        { to: "conn", connId, msg: { t: "roomCreated", code: this.data.code, screenToken } },
        ...this.broadcastRoomState(),
      ];
    }

    if (msg.t === "joinRoom") {
      // A socket already holding a player slot cannot mint another one - the actual flood fix,
      // not a rate limit (a limiter only slows an unbounded resource, never bounds it).
      if (conn?.playerId) return [{ to: "conn", connId, msg: { t: "error", code: "already_joined", message: "Connection already joined" } }];
      const result = this.join({ name: msg.name, colorId: msg.colorId, avatarId: msg.avatarId }, msg.token);
      if (!result.ok) return [{ to: "conn", connId, msg: { t: "error", code: result.code, message: result.message } }];
      this.info(`${result.via === "reconnect" ? "reconnected" : "joined"} playerId=${result.playerId}`);
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
      if (this.limited("setIdentity", connId, now, UI_ACTION_LIMIT)) return [];
      const p = this.data.players[conn.playerId];
      if (p) { p.name = msg.name; p.colorId = msg.colorId; p.avatarId = msg.avatarId; }
      return this.broadcastRoomState();
    }

    // Host-gated types (here, config* below) stay unlimited: threat model is a compromised host.
    if (msg.t === "lobbyNav" || msg.t === "lobbyFocus" || msg.t === "lobbyConfirm" || msg.t === "returnToLobby" || msg.t === "transferHost" || msg.t === "rematch" || msg.t === "inputLegend") {
      if (!conn?.playerId || this.data.hostId !== conn.playerId) return [];
      if (msg.t === "inputLegend") {
        const next = msg.entries.length ? { playerId: conn.playerId, entries: msg.entries } : null;
        if (JSON.stringify(next) === JSON.stringify(this.data.inputLegend)) return [];
        this.data.inputLegend = next;
        return this.broadcastRoomState();
      }
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
        this.info(`game finished gameId=${this.data.currentGameId}`);
        this.data.lastGameState = null;
        this.data.failedGameId = null;
        this.data.mode = "lobby";
        this.data.currentGameId = null;
        this.data.suggestions = {};
        return this.broadcastRoomState();
      }
      if (msg.t === "transferHost") {
        const target = this.data.players[msg.toPlayerId];
        if (!target?.connected) return [];
        this.data.hostId = msg.toPlayerId;
        this.data.inputLegend = null;
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
      if (this.limited("suggestGame", connId, now, UI_ACTION_LIMIT)) return [];
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
      if (this.limited("action", connId, now, ACTION_LIMIT)) return [];
      return [{ to: "conn", connId: this.data.screenConnId, msg: { t: "gameAction", playerId: conn.playerId, payload: msg.payload, now } }];
    }

    if (msg.t === "rtcSignal") {
      // Pure forwarding by connId - the payload (SDP/ICE) is never parsed or stored here.
      if (this.limited("rtcSignal", connId, now, RTC_SIGNAL_LIMIT)) return [];
      if (conn?.role === "screen") {
        const targetConnId = msg.toPlayerId ? this.connIdForPlayer(msg.toPlayerId) : null;
        if (!targetConnId) return [];
        return [{ to: "conn", connId: targetConnId, msg: { t: "rtcSignal", data: msg.data } }];
      }
      if (!conn?.playerId || !this.data.screenConnId) return [];
      return [{ to: "conn", connId: this.data.screenConnId, msg: { t: "rtcSignal", fromPlayerId: conn.playerId, data: msg.data } }];
    }

    if (msg.t === "gameStatePush") {
      // The obvious forgery hole: only the room's own screen connection may push state, and
      // only for the game currently in play - not a controller, and not a stale/superseded launch.
      if (conn?.role !== "screen" || this.data.screenConnId !== connId) return [];
      if (this.data.mode !== "in-game" || this.data.currentGameId !== msg.gameId) return [];
      if (this.limited("gameStatePush", connId, now, GAME_STATE_PUSH_LIMIT)) return [];
      this.data.lastGameState = { gameId: msg.gameId, state: msg.state };
      // Noisy path: a real-time game pushes state at tickRateHz, so this stays off by default
      // (state itself is never logged - only relay knows a push happened, never its shape).
      this.debug(() => `state pushed gameId=${msg.gameId}`);
      return [{ to: "all", msg: { t: "gameState", gameId: msg.gameId, state: msg.state } }];
    }

    // Same trust boundary as gameStatePush: only the room's own screen, only for the game in play.
    // The staleness half matters more here than there - these arrive on a 4s delay, so without it
    // a timer from a dead game can yank the room out of the next one.
    if (msg.t === "reportGameFailure" || msg.t === "returnFromFailure") {
      if (conn?.role !== "screen" || this.data.screenConnId !== connId) return [];
      if (this.data.mode !== "in-game" || this.data.currentGameId !== msg.gameId) return [];
      if (msg.t === "reportGameFailure") {
        this.info(`game failed gameId=${msg.gameId}`);
        this.data.failedGameId = msg.gameId;
        return [{ to: "all", msg: { t: "gameFailure", gameId: msg.gameId } }];
      }
      if (this.data.failedGameId !== msg.gameId) return [];
      this.data.failedGameId = null;
      this.data.lastGameState = null;
      this.data.mode = "lobby";
      this.data.currentGameId = null;
      this.data.suggestions = {};
      return this.broadcastRoomState();
    }

    return [];
  }

  handleDisconnect(connId: string): Outbound[] {
    const conn = this.data.connections[connId];
    if (!conn) return [];
    delete this.data.connections[connId];
    for (const perConn of Object.values(this.msgHits)) delete perConn[connId];
    if (conn.role === "screen") {
      if (this.data.screenConnId === connId) this.data.screenConnId = null;
      this.info("screen closed");
      return [];
    }
    if (conn.playerId) {
      this.info(`left playerId=${conn.playerId}`);
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
    this.info(`setup started gameId=${gameId} players=${players.length}`);
    let setupData: unknown;
    // setup() may await a network fetch for many seconds. The caller's `now` was stamped before
    // it, so a game whose init starts a clock would begin its first round already that far
    // behind. Elapsed, not a wall clock: the room still never reads the time itself.
    const setupStartedAt = performance.now();
    try {
      setupData = await this.catalog.setup(gameId, options, players);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Game setup failed";
      this.info(`setup_failed gameId=${gameId} reason=${message}`);
      // The TV is the surface a room full of people is looking at, so it gets the game's own
      // message too - the host's phone alone leaves everyone else staring at an unchanged screen.
      const out: Outbound[] = [];
      const err_ = { t: "error", code: "setup_failed", message } as const;
      if (notifyConnId) out.push({ to: "conn", connId: notifyConnId, msg: err_ });
      if (this.data.screenConnId && this.data.screenConnId !== notifyConnId) {
        out.push({ to: "conn", connId: this.data.screenConnId, msg: err_ });
      }
      return out;
    }
    this.info(`game launched gameId=${gameId}`);
    this.data.lastOptions = options;
    this.data.lastGameState = null;
    this.data.failedGameId = null;
    this.data.mode = "in-game";
    this.data.currentGameId = gameId;
    this.data.config = null;
    this.data.suggestions = {};
    const out = this.broadcastRoomState();
    if (this.data.screenConnId) {
      const launchedAt = now + Math.round(performance.now() - setupStartedAt);
      out.push({ to: "conn", connId: this.data.screenConnId, msg: { t: "gameLaunch", gameId, players, setupData, now: launchedAt } });
    }
    return out;
  }

  private join(identity: Identity, token?: string): { ok: true; playerId: string; token: string; via: "reconnect" | "new" } | { ok: false; code: "no_room"; message: string } {
    if (token) {
      for (const p of Object.values(this.data.players)) {
        if (timingSafeEqual(p.token, token)) {
          p.name = identity.name; p.colorId = identity.colorId; p.avatarId = identity.avatarId;
          p.connected = true;
          this.ensureHost();
          return { ok: true, playerId: p.id, token: p.token, via: "reconnect" };
        }
      }
    }
    const id = this.tokens.next();
    const tok = this.tokens.next();
    this.data.players[id] = { id, name: identity.name, colorId: identity.colorId, avatarId: identity.avatarId, connected: true, token: tok };
    this.ensureHost();
    return { ok: true, playerId: id, token: tok, via: "new" };
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
  private connIdForPlayer(playerId: string): string | null {
    for (const [connId, info] of Object.entries(this.data.connections)) {
      if (info.playerId === playerId) return connId;
    }
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

  /** Read through the author check on every broadcast, so a host that drops or hands the room on
   * takes its legend with it without every mutation site having to remember. */
  private liveInputLegend(): InputLegendEntry[] | undefined {
    const legend = this.data.inputLegend;
    if (!legend || legend.playerId !== this.data.hostId) return undefined;
    return this.data.players[legend.playerId]?.connected ? legend.entries : undefined;
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
      inputLegend: this.liveInputLegend(),
    };
    return [{ to: "all", msg }];
  }
}
