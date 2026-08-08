import { describe, it, expect, afterEach } from "vitest";
import { WebSocket } from "ws";
import { ROOM_CODE_LENGTH, createRoomHttp, roomSocketUrl } from "@hubbub/protocol";
import { noopLogger } from "@hubbub/relay";
import { createServer } from "./server.js";

let handle: ReturnType<typeof createServer> | undefined;
afterEach(async () => await handle?.close());

const openWs = (url: string) =>
  new Promise<WebSocket>((res) => {
    const ws = new WebSocket(url);
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
    handle = createServer(0, {}, {}, noopLogger);
    const port = (handle.server.address() as { port: number }).port;
    const base = `ws://localhost:${port}`;

    const code = await createRoomHttp(base);
    expect(code).toHaveLength(ROOM_CODE_LENGTH);
    const screen = await openWs(roomSocketUrl(base, code));
    screen.send(JSON.stringify({ t: "attachScreen" }));
    await nextOf(screen, "roomCreated");

    const controller = await openWs(roomSocketUrl(base, code));
    controller.send(JSON.stringify({ t: "joinRoom", name: "Joe", colorId: 3, emoji: "🦊" }));
    const joined = await nextOf(controller, "joined");

    const room = await nextOf(screen, "roomState");
    expect(room.mode).toBe("lobby");
    expect(room.hostId).toBe(joined.playerId);
    expect(room.players).toEqual([
      { id: joined.playerId, name: "Joe", colorId: 3, emoji: "🦊", connected: true },
    ]);

    screen.close();
    controller.close();
  });

  // Node's fetch doesn't enforce CORS, so this can only catch a regression by asserting
  // the header itself is present, not by reproducing the browser's block.
  it("sends Access-Control-Allow-Origin on POST /api/rooms and its OPTIONS preflight", async () => {
    handle = createServer(0, {}, {}, noopLogger);
    const port = (handle.server.address() as { port: number }).port;
    const base = `http://localhost:${port}`;

    const post = await fetch(`${base}/api/rooms`, { method: "POST" });
    expect(post.headers.get("access-control-allow-origin")).toBe("*");

    const preflight = await fetch(`${base}/api/rooms`, { method: "OPTIONS" });
    expect(preflight.headers.get("access-control-allow-origin")).toBe("*");
    expect(preflight.headers.get("access-control-allow-methods")).toContain("POST");
  });
});
