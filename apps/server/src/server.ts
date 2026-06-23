import { WebSocketServer, type WebSocket } from "ws";
import { parseClientMessage, type ServerMessage } from "@hubbub/protocol";
import { RoomManager } from "./rooms.js";

interface ConnState {
  roomCode?: string;
  playerId?: string;
  role?: "screen" | "controller";
}

export function createServer(port: number) {
  const wss = new WebSocketServer({ port });
  const rooms = new RoomManager();
  // code -> set of sockets (screen + controllers) for broadcast
  const sockets = new Map<string, Set<WebSocket>>();
  const state = new WeakMap<WebSocket, ConnState>();

  function send(ws: WebSocket, msg: ServerMessage) {
    ws.send(JSON.stringify(msg));
  }
  function broadcastRoomState(code: string) {
    const players = rooms.players(code);
    const msg: ServerMessage = { t: "roomState", players };
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
    close: () =>
      new Promise<void>((resolve) => {
        wss.clients.forEach((c) => c.terminate());
        wss.close(() => resolve());
      }),
  };
}
