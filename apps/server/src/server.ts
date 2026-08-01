import { WebSocketServer, type WebSocket } from "ws";
import { parseClientMessage, type GameSummary, type ServerMessage } from "@hubbub/protocol";
import { GameInstance, gameSummaries, visibleSettingsFields, type GameRegistry, type PlayerInfo, type SettingsField } from "@hubbub/sdk";
import { getSettingsSchema } from "@hubbub/games/settings";
import { RoomManager } from "./rooms.js";

function defaultConfigValues(schema: SettingsField[]): Record<string, string> {
  const values: Record<string, string> = {};
  for (const f of schema) values[f.key] = f.default;
  return values;
}

interface ConnState { roomCode?: string; playerId?: string; role?: "screen" | "controller"; }

export function createServer(port: number, games: GameRegistry) {
  const wss = new WebSocketServer({ port });
  const rooms = new RoomManager();
  const sockets = new Map<string, Set<WebSocket>>();
  const instances = new Map<string, GameInstance<any, any>>();
  const lastOptions = new Map<string, unknown>();
  const timers = new Map<string, NodeJS.Timeout>();
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
  function broadcastGameState(code: string) {
    const inst = instances.get(code);
    const gameId = rooms.currentGameId(code);
    if (!inst || !gameId) return;
    broadcast(code, { t: "gameState", gameId, state: inst.get() });
  }
  const connectedInfo = (code: string): PlayerInfo[] =>
    rooms.connectedPlayers(code).map((p) => ({ id: p.id, name: p.name }));

  function clearTimer(code: string) {
    const t = timers.get(code);
    if (t) { clearTimeout(t); timers.delete(code); }
  }
  // Reschedules the room's single pending timeout to the game's own next deadline (if any). Games
  // without nextDeadline/onTimeout never get a timer - this is a no-op for ttt/uttt/tap-race.
  function scheduleTimer(code: string) {
    clearTimer(code);
    const inst = instances.get(code);
    const deadline = inst?.nextDeadline();
    if (deadline === null || deadline === undefined) return;
    const delay = Math.max(0, deadline - Date.now());
    timers.set(code, setTimeout(() => {
      const cur = instances.get(code);
      if (cur?.checkTimeout(Date.now())) broadcastGameState(code);
      scheduleTimer(code);
    }, delay));
  }

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
    instances.set(code, new GameInstance(logic, players, setupData, Date.now()));
    rooms.setMode(code, "in-game", summary.id);
    rooms.clearConfig(code);
    rooms.clearSuggestions(code);
    broadcastRoomState(code);
    broadcastGameState(code);
    scheduleTimer(code);
  }
  function launchAtCursor(code: string, options: unknown, notifyWs?: WebSocket) {
    const summary = summaries[rooms.cursorIndex(code)];
    if (summary) void launchGame(code, summary, options, notifyWs);
  }

  wss.on("connection", (ws) => {
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
        send(ws, { t: "roomCreated", code });
        broadcastRoomState(code);
        return;
      }

      if (msg.t === "joinRoom") {
        const result = rooms.join(msg.code, { name: msg.name, colorId: msg.colorId, emoji: msg.emoji }, msg.token);
        if (!result.ok) { send(ws, { t: "error", code: result.code, message: result.message }); return; }
        cs.role = "controller"; cs.roomCode = msg.code; cs.playerId = result.playerId;
        sockets.get(msg.code)?.add(ws);
        send(ws, { t: "joined", playerId: result.playerId, token: result.token });
        broadcastRoomState(msg.code);
        if (rooms.mode(msg.code) === "in-game") broadcastGameState(msg.code);
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
          clearTimer(code);
          instances.delete(code);
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
        const inst = instances.get(code);
        if (!inst) return;
        inst.applyAction(cs.playerId, msg.payload, Date.now());
        broadcastGameState(code);
        scheduleTimer(code);
        return;
      }
    });

    ws.on("close", () => {
      const cs = state.get(ws);
      if (!cs?.roomCode) return;
      sockets.get(cs.roomCode)?.delete(ws);
      if (cs.role === "controller" && cs.playerId) {
        rooms.setConnected(cs.roomCode, cs.playerId, false);
        rooms.dropSuggestion(cs.roomCode, cs.playerId);
        broadcastRoomState(cs.roomCode);
      }
    });
  });

  return {
    wss,
    close: () => new Promise<void>((resolve) => {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
      wss.clients.forEach((c) => c.terminate());
      wss.close(() => resolve());
    }),
  };
}
