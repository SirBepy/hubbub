import { describe, it, expect, afterEach } from "vitest";
import { WebSocket } from "ws";
import { createServer } from "./server.js";

let handle: ReturnType<typeof createServer> | undefined;
afterEach(async () => await handle?.close());

function open(port: number) {
  const ws = new WebSocket(`ws://localhost:${port}`);
  return new Promise<WebSocket>((res) => ws.on("open", () => res(ws)));
}
function next(ws: WebSocket) {
  return new Promise<any>((res) => ws.once("message", (m) => res(JSON.parse(m.toString()))));
}

describe("createServer", () => {
  it("creates a room then a controller joins and screen sees the player", async () => {
    handle = createServer(0);
    const port = (handle.wss.address() as { port: number }).port;

    const screen = await open(port);
    screen.send(JSON.stringify({ t: "createRoom" }));
    const created = await next(screen);
    expect(created.t).toBe("roomCreated");

    const controller = await open(port);
    controller.send(JSON.stringify({ t: "joinRoom", code: created.code, name: "Joe" }));
    const joined = await next(controller);
    expect(joined.t).toBe("joined");

    const state = await next(screen);
    expect(state.t).toBe("roomState");
    expect(state.players).toEqual([
      { id: joined.playerId, name: "Joe", connected: true },
    ]);

    screen.close();
    controller.close();
  });
});
