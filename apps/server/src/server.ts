import { WebSocketServer, type WebSocket } from "ws";
import { parseClientMessage, type GameSummary, type ServerMessage } from "@hubbub/protocol";
import { gameSummaries, visibleSettingsFields, type GameRegistry, type PlayerInfo, type SettingsField } from "@hubbub/sdk";
import { getSettingsSchema } from "@hubbub/games/settings";
import { RoomManager } from "./rooms.js";

function defaultConfigValues(schema: SettingsField[]): Record<string, string> {
  const values: Record<string, string> = {};
  for (const f of schema) values[f.key] = f.default;
  return values;
}

interface ConnState { roomCode?: string; playerId?: string; role?: "screen" | "controller"; }

interface RateLimitConfig { max: number; windowMs: number; }
export interface JoinRateLimitOptions { perIp?: RateLimitConfig; perCode?: RateLimitConfig; }

// Real thresholds (design spec "Room codes and abuse"). Injectable so tests can throttle
// without firing 20+ real messages from the loopback address they all share.
const DEFAULT_PER_IP: RateLimitConfig = { max: 20, windowMs: 60_000 };
const DEFAULT_PER_CODE: RateLimitConfig = { max: 10, windowMs: 60_000 };
const RATE_LIMIT_MESSAGE = "Too many join attempts. Try again shortly.";

// Sliding window via a per-key timestamp list, pruned on each hit. In-memory and reset on
// restart is fine: rooms are already ephemeral with no persistence layer to match.
function createLimiter({ max, windowMs }: RateLimitConfig) {
  const hits = new Map<string, number[]>();
  return (key: string, now: number): boolean => {
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    recent.push(now);
    hits.set(key, recent);
    return recent.length > max;
  };
}

export function createServer(port: number, games: GameRegistry, rateLimit: JoinRateLimitOptions = {}) {
  const wss = new WebSocketServer({ port });
  const ipLimited = createLimiter(rateLimit.perIp ?? DEFAULT_PER_IP);
  const codeLimited = createLimiter(rateLimit.perCode ?? DEFAULT_PER_CODE);
  const rooms = new RoomManager();
  const sockets = new Map<string, Set<WebSocket>>();
  const screens = new Map<string, WebSocket>();
  const lastOptions = new Map<string, unknown>();
  // Last state a screen pushed, per room - pure passthrough cache (never fed into a reducer)
  // so a mid-game joiner/reconnect gets the current state without waiting for the next action.
  const lastGameState = new Map<string, { gameId: string; state: unknown }>();
  const state = new WeakMap<WebSocket, ConnState>();
  const summaries = gameSummaries(games);
  const count = summaries.length;

  const send = (ws: WebSocket, msg: ServerMessage) => ws.send(JSON.stringify(msg));
  const broadcast = (code: string, msg: ServerMessage) => sockets.get(code)?.forEach((ws) => send(ws, msg));

  function broadcastRoomState(code: string) {
    broadcast(code, {
      t: "roomState",
      players: rooms.players(code),
      hostId: rooms.hostId(code),
      mode: rooms.mode(code),
      currentGameId: rooms.currentGameId(code),
      cursorIndex: rooms.cursorIndex(code),
      games: summaries,
      suggestions: rooms.suggestions(code),
      config: rooms.config(code),
    });
  }
  // Relays the screen-authoritative state exactly as the server-computed broadcast used to
  // (see rooms/server.ts history) - the server never runs the reducer itself now.
  function broadcastGameState(code: string, gameId: string, gameState: unknown) {
    broadcast(code, { t: "gameState", gameId, state: gameState });
  }
  const connectedInfo = (code: string): PlayerInfo[] =>
    rooms.connectedPlayers(code).map((p) => ({ id: p.id, name: p.name }));

  // setup() stays server-side (may do network I/O); the screen calls init() itself with the
  // resulting setupData (design spec Phase B, "Authority" / out-of-scope note on setup()).
  async function launchGame(code: string, summary: GameSummary, options: unknown, notifyWs?: WebSocket) {
    const players = connectedInfo(code);
    if (players.length < summary.minPlayers) return;
    const logic = games[summary.id];
    let setupData: unknown;
    if (logic.setup) {
      try {
        setupData = await logic.setup(options, players);
      } catch (err) {
        if (notifyWs) {
          send(notifyWs, {
            t: "error",
            code: "setup_failed",
            message: err instanceof Error ? err.message : "Game setup failed",
          });
        }
        return;
      }
    }
    lastOptions.set(code, options);
    lastGameState.delete(code);
    rooms.setMode(code, "in-game", summary.id);
    rooms.clearConfig(code);
    rooms.clearSuggestions(code);
    broadcastRoomState(code);
    const screenWs = screens.get(code);
    if (screenWs) send(screenWs, { t: "gameLaunch", gameId: summary.id, players, setupData, now: Date.now() });
  }
  function launchAtCursor(code: string, options: unknown, notifyWs?: WebSocket) {
    const summary = summaries[rooms.cursorIndex(code)];
    if (summary) void launchGame(code, summary, options, notifyWs);
  }

  wss.on("connection", (ws, req) => {
    // Behind a future Cloudflare deployment every connection shares the proxy's own address;
    // read the `CF-Connecting-IP` header there instead of remoteAddress.
    const ip = req.socket.remoteAddress ?? "unknown";
    state.set(ws, {});
    ws.on("message", (raw) => {
      let msg;
      try { msg = parseClientMessage(raw.toString()); }
      catch { send(ws, { t: "error", code: "bad_message", message: "Invalid message" }); return; }
      const cs = state.get(ws)!;

      if (msg.t === "createRoom") {
        const code = rooms.createRoom();
        cs.role = "screen"; cs.roomCode = code;
        sockets.set(code, new Set([ws]));
        screens.set(code, ws);
        send(ws, { t: "roomCreated", code });
        broadcastRoomState(code);
        return;
      }

      if (msg.t === "joinRoom") {
        const now = Date.now();
        // Per-code counts only failures, so guessing at one room throttles harder than joining.
        if (ipLimited(ip, now)) { send(ws, { t: "error", code: "rate_limited", message: RATE_LIMIT_MESSAGE }); return; }
        const result = rooms.join(msg.code, { name: msg.name, colorId: msg.colorId, emoji: msg.emoji }, msg.token);
        if (!result.ok) {
          // Same shape either way, so a rate-limited guess is indistinguishable from a
          // plain wrong-code reply - neither confirms nor denies the room's existence.
          if (codeLimited(msg.code, now)) { send(ws, { t: "error", code: "rate_limited", message: RATE_LIMIT_MESSAGE }); return; }
          send(ws, { t: "error", code: result.code, message: result.message }); return;
        }
        cs.role = "controller"; cs.roomCode = msg.code; cs.playerId = result.playerId;
        sockets.get(msg.code)?.add(ws);
        send(ws, { t: "joined", playerId: result.playerId, token: result.token });
        broadcastRoomState(msg.code);
        const cached = lastGameState.get(msg.code);
        if (rooms.mode(msg.code) === "in-game" && cached) send(ws, { t: "gameState", gameId: cached.gameId, state: cached.state });
        return;
      }

      const code = cs.roomCode;
      if (!code) return;

      if (msg.t === "setIdentity") {
        if (!cs.playerId) return;
        rooms.setIdentity(code, cs.playerId, { name: msg.name, colorId: msg.colorId, emoji: msg.emoji });
        broadcastRoomState(code);
        return;
      }

      if (msg.t === "lobbyNav" || msg.t === "lobbyFocus" || msg.t === "lobbyConfirm" || msg.t === "returnToLobby" || msg.t === "transferHost" || msg.t === "rematch") {
        if (!cs.playerId || !rooms.isHost(code, cs.playerId)) return;
        if (msg.t === "lobbyNav") {
          if (rooms.mode(code) !== "lobby") return;
          rooms.moveCursor(code, msg.dir, count);
          broadcastRoomState(code);
        } else if (msg.t === "lobbyFocus") {
          if (rooms.mode(code) !== "lobby") return;
          rooms.focusCursor(code, msg.index, count);
          broadcastRoomState(code);
        } else if (msg.t === "lobbyConfirm") {
          if (rooms.mode(code) !== "lobby") return;
          launchAtCursor(code, msg.options, ws);
        } else if (msg.t === "returnToLobby") {
          lastGameState.delete(code);
          rooms.setMode(code, "lobby", null);
          rooms.clearSuggestions(code);
          broadcastRoomState(code);
        } else if (msg.t === "transferHost") {
          if (rooms.transferHost(code, cs.playerId, msg.toPlayerId)) broadcastRoomState(code);
        } else if (msg.t === "rematch") {
          if (rooms.mode(code) !== "in-game") return;
          const summary = summaries.find((s) => s.id === rooms.currentGameId(code));
          if (summary) void launchGame(code, summary, lastOptions.get(code), ws);
        }
        return;
      }

      if (msg.t === "suggestGame") {
        if (!cs.playerId || rooms.mode(code) !== "lobby") return;
        if (!games[msg.gameId]) return;
        rooms.suggest(code, cs.playerId, msg.gameId);
        broadcastRoomState(code);
        return;
      }

      if (msg.t === "configStart") {
        if (!cs.playerId || !rooms.isHost(code, cs.playerId)) return;
        if (rooms.mode(code) !== "lobby") return;
        const summary = summaries[rooms.cursorIndex(code)];
        if (!summary) return;
        const schema = getSettingsSchema(summary.id);
        // No schema (ttt/uttt/tap-race) - skip configuring entirely, start exactly as today.
        if (!schema) { launchAtCursor(code, undefined, ws); return; }
        rooms.startConfig(code, summary.id, defaultConfigValues(schema));
        broadcastRoomState(code);
        return;
      }

      if (msg.t === "configCursor" || msg.t === "configAdjust" || msg.t === "configSet" || msg.t === "configConfirm" || msg.t === "configCancel") {
        if (!cs.playerId || !rooms.isHost(code, cs.playerId)) return;
        if (rooms.mode(code) !== "configuring") return;
        const cfg = rooms.config(code);
        if (!cfg) return;
        const schema = getSettingsSchema(cfg.gameId) ?? [];

        if (msg.t === "configCursor") {
          rooms.moveConfigCursor(code, msg.dir, visibleSettingsFields(schema, cfg.values).length);
          broadcastRoomState(code);
        } else if (msg.t === "configAdjust") {
          const field = schema.find((f) => f.key === msg.field && f.type === "choice");
          if (field?.options?.length) {
            const curIdx = Math.max(0, field.options.findIndex((o) => o.value === cfg.values[msg.field]));
            const delta = msg.dir === "left" ? -1 : 1;
            const opts = field.options;
            const nextIdx = ((curIdx + delta) % opts.length + opts.length) % opts.length;
            rooms.setConfigValue(code, msg.field, opts[nextIdx].value);
            rooms.clampConfigCursor(code, visibleSettingsFields(schema, rooms.config(code)!.values).length);
            broadcastRoomState(code);
          }
        } else if (msg.t === "configSet") {
          const field = schema.find((f) => f.key === msg.field && f.type === "text");
          if (field) {
            rooms.setConfigValue(code, msg.field, msg.value);
            broadcastRoomState(code);
          }
        } else if (msg.t === "configConfirm") {
          const summary = summaries.find((s) => s.id === cfg.gameId);
          if (summary) void launchGame(code, summary, { ...cfg.values }, ws);
        } else if (msg.t === "configCancel") {
          rooms.cancelConfig(code);
          broadcastRoomState(code);
        }
        return;
      }

      if (msg.t === "action") {
        if (!cs.playerId || rooms.mode(code) !== "in-game") return;
        const screenWs = screens.get(code);
        if (!screenWs) return;
        send(screenWs, { t: "gameAction", playerId: cs.playerId, payload: msg.payload, now: Date.now() });
        return;
      }

      if (msg.t === "gameStatePush") {
        // The obvious forgery hole: only the room's own screen socket may push state, and only
        // for the game currently in play - not a controller, and not a stale/superseded launch.
        if (cs.role !== "screen" || screens.get(code) !== ws) return;
        if (rooms.mode(code) !== "in-game" || rooms.currentGameId(code) !== msg.gameId) return;
        lastGameState.set(code, { gameId: msg.gameId, state: msg.state });
        broadcastGameState(code, msg.gameId, msg.state);
        return;
      }
    });

    ws.on("close", () => {
      const cs = state.get(ws);
      if (!cs?.roomCode) return;
      sockets.get(cs.roomCode)?.delete(ws);
      if (cs.role === "screen" && screens.get(cs.roomCode) === ws) {
        screens.delete(cs.roomCode);
      } else if (cs.role === "controller" && cs.playerId) {
        rooms.setConnected(cs.roomCode, cs.playerId, false);
        rooms.dropSuggestion(cs.roomCode, cs.playerId);
        broadcastRoomState(cs.roomCode);
      }
    });
  });

  return {
    wss,
    close: () => new Promise<void>((resolve) => {
      wss.clients.forEach((c) => c.terminate());
      wss.close(() => resolve());
    }),
  };
}
