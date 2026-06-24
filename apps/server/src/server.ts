import { WebSocketServer, type WebSocket } from "ws";
import { parseClientMessage, type ServerMessage } from "@hubbub/protocol";
import { GameInstance, type GameLogic, type PlayerInfo } from "@hubbub/sdk";
import { RoomManager } from "./rooms.js";

interface ConnState {
  roomCode?: string;
  playerId?: string;
  role?: "screen" | "controller";
}

export function createServer(port: number, game?: GameLogic<any, any>) {
  const wss = new WebSocketServer({ port });
  const rooms = new RoomManager();
  // code -> set of sockets (screen + controllers) for broadcast
  const sockets = new Map<string, Set<WebSocket>>();
  const games = new Map<string, GameInstance<any, any>>();
  const state = new WeakMap<WebSocket, ConnState>();

  function send(ws: WebSocket, msg: ServerMessage) {
    ws.send(JSON.stringify(msg));
  }
  function broadcastRoomState(code: string) {
    const players = rooms.players(code);
    const msg: ServerMessage = { t: "roomState", players };
    sockets.get(code)?.forEach((ws) => send(ws, msg));
  }
  function toPlayerInfo(code: string): PlayerInfo[] {
    return rooms.players(code).map((p) => ({ id: p.id, name: p.name }));
  }
  function broadcastGameState(code: string) {
    const gi = games.get(code);
    if (!gi) return;
    const msg: ServerMessage = { t: "gameState", state: gi.get() };
    sockets.get(code)?.forEach((ws) => send(ws, msg));
  }

  wss.on("connection", (ws) => {
    state.set(ws, {});
    ws.on("message", (raw) => {
      let msg;
      try {
        msg = parseClientMessage(raw.toString());
      } catch {
        send(ws, { t: "error", code: "bad_message", message: "Invalid message" });
        return;
      }
      const cs = state.get(ws)!;

      if (msg.t === "createRoom") {
        const code = rooms.createRoom();
        cs.role = "screen";
        cs.roomCode = code;
        sockets.set(code, new Set([ws]));
        if (game) games.set(code, new GameInstance(game, []));
        send(ws, { t: "roomCreated", code });
        return;
      }

      if (msg.t === "joinRoom") {
        const result = rooms.join(msg.code, msg.name, msg.token);
        if (!result.ok) {
          send(ws, { t: "error", code: result.code, message: result.message });
          return;
        }
        cs.role = "controller";
        cs.roomCode = msg.code;
        cs.playerId = result.playerId;
        sockets.get(msg.code)?.add(ws);
        send(ws, { t: "joined", playerId: result.playerId, token: result.token });
        broadcastRoomState(msg.code);
        const gi = games.get(msg.code);
        if (gi) {
          gi.playersChanged(toPlayerInfo(msg.code));
          broadcastGameState(msg.code);
        }
        return;
      }

      if (msg.t === "action") {
        if (!cs.roomCode || !cs.playerId) return;
        const inst = games.get(cs.roomCode);
        if (!inst) return;
        inst.applyAction(cs.playerId, msg.payload);
        broadcastGameState(cs.roomCode);
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
        const gi = games.get(cs.roomCode);
        if (gi) {
          gi.playersChanged(toPlayerInfo(cs.roomCode));
          broadcastGameState(cs.roomCode);
        }
      }
    });
  });

  return {
    wss,
    close: () =>
      new Promise<void>((resolve) => {
        wss.clients.forEach((c) => c.terminate());
        wss.close(() => resolve());
      }),
  };
}
