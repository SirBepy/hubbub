import { describe, it, expect, afterEach } from "vitest";
import { WebSocket } from "ws";
import { createServer } from "./server.js";

let handle: ReturnType<typeof createServer> | undefined;
afterEach(async () => await handle?.close());

const open = (port: number) =>
  new Promise<WebSocket>((res) => {
    const ws = new WebSocket(`ws://localhost:${port}`);
    ws.on("open", () => res(ws));
  });
const nextOf = (ws: WebSocket, t: string) =>
  new Promise<any>((res) => {
    const h = (m: any) => {
      const msg = JSON.parse(m.toString());
      if (msg.t === t) { ws.off("message", h); res(msg); }
    };
    ws.on("message", h);
  });

describe("createServer", () => {
  it("creates a room then a controller joins and the screen sees the player + lobby context", async () => {
    handle = createServer(0, {});
    const port = (handle.wss.address() as { port: number }).port;

    const screen = await open(port);
    screen.send(JSON.stringify({ t: "createRoom" }));
    const created = await nextOf(screen, "roomCreated");
    expect(created.code).toHaveLength(4);

    const controller = await open(port);
    controller.send(JSON.stringify({ t: "joinRoom", code: created.code, name: "Joe", color: "#4363d8", emoji: "🦊" }));
    const joined = await nextOf(controller, "joined");

    const room = await nextOf(screen, "roomState");
    expect(room.mode).toBe("lobby");
    expect(room.hostId).toBe(joined.playerId);
    expect(room.players).toEqual([
      { id: joined.playerId, name: "Joe", color: "#4363d8", emoji: "🦊", connected: true },
    ]);

    screen.close();
    controller.close();
  });
});
