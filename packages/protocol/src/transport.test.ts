import { describe, it, expect, afterEach } from "vitest";
import { WebSocket as WsWebSocket, WebSocketServer } from "ws";
import { WebSocketClientTransport } from "./transport.js";

// transport.ts is browser code, where WebSocket is always global. Node only gained it globally
// in 22, so without this the suite would silently raise the repo's real Node floor to 22.
globalThis.WebSocket ??= WsWebSocket as unknown as typeof globalThis.WebSocket;

let wss: WebSocketServer | undefined;
afterEach(() => wss?.close());

describe("WebSocketClientTransport", () => {
  it("connects, sends a typed message, and receives a typed reply", async () => {
    wss = new WebSocketServer({ port: 0 });
    await new Promise((r) => wss!.on("listening", r));
    const { port } = wss.address() as { port: number };

    wss.on("connection", (ws) => {
      ws.on("message", (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.t === "attachScreen") {
          ws.send(JSON.stringify({ t: "roomCreated", code: "ABCD" }));
        }
      });
    });

    const t = new WebSocketClientTransport(`ws://localhost:${port}`);
    await t.connect();
    const got = await new Promise((resolve) => {
      t.onMessage(resolve);
      t.send({ t: "attachScreen" });
    });
    expect(got).toEqual({ t: "roomCreated", code: "ABCD" });
    t.close();
  });
});
