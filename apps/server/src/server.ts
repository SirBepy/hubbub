import { WebSocketServer, type WebSocket } from "ws";
import { parseClientMessage, type ServerMessage } from "@hubbub/protocol";
import { GameInstance, gameSummaries, type GameRegistry, type PlayerInfo } from "@hubbub/sdk";
import { RoomManager } from "./rooms.js";

interface ConnState { roomCode?: string; playerId?: string; role?: "screen" | "controller"; }

export function createServer(port: number, games: GameRegistry) {
  const wss = new WebSocketServer({ port });
  const rooms = new RoomManager();
  const sockets = new Map<string, Set<WebSocket>>();
  const instances = new Map<string, GameInstance<any, any>>();
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

  function launchAtCursor(code: string) {
    const summary = summaries[rooms.cursorIndex(code)];
    if (!summary) return;
    const players = connectedInfo(code);
    if (players.length < summary.minPlayers) return;
    instances.set(code, new GameInstance(games[summary.id], players));
    rooms.setMode(code, "in-game", summary.id);
    broadcastRoomState(code);
    broadcastGameState(code);
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
        const result = rooms.join(msg.code, { name: msg.name, color: msg.color, emoji: msg.emoji }, msg.token);
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
        rooms.setIdentity(code, cs.playerId, { name: msg.name, color: msg.color, emoji: msg.emoji });
        broadcastRoomState(code);
        return;
      }

      if (msg.t === "lobbyNav" || msg.t === "lobbyFocus" || msg.t === "lobbyConfirm" || msg.t === "returnToLobby" || msg.t === "transferHost") {
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
          launchAtCursor(code);
        } else if (msg.t === "returnToLobby") {
          instances.delete(code);
          rooms.setMode(code, "lobby", null);
          broadcastRoomState(code);
        } else if (msg.t === "transferHost") {
          if (rooms.transferHost(code, cs.playerId, msg.toPlayerId)) broadcastRoomState(code);
        }
        return;
      }

      if (msg.t === "action") {
        if (!cs.playerId || rooms.mode(code) !== "in-game") return;
        const inst = instances.get(code);
        if (!inst) return;
        inst.applyAction(cs.playerId, msg.payload);
        broadcastGameState(code);
        return;
      }
    });

    ws.on("close", () => {
      const cs = state.get(ws);
      if (!cs?.roomCode) return;
      sockets.get(cs.roomCode)?.delete(ws);
      if (cs.role === "controller" && cs.playerId) {
        rooms.setConnected(cs.roomCode, cs.playerId, false);
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
