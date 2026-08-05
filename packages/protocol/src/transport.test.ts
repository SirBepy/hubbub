import { describe, it, expect, afterEach } from "vitest";
import { WebSocketServer } from "ws";
import { WebSocketClientTransport } from "./transport.js";

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
        if (msg.t === "createRoom") {
          ws.send(JSON.stringify({ t: "roomCreated", code: "ABCDEF" }));
        }
      });
    });

    const t = new WebSocketClientTransport(`ws://localhost:${port}`);
    await t.connect();
    const got = await new Promise((resolve) => {
      t.onMessage(resolve);
      t.send({ t: "createRoom" });
    });
    expect(got).toEqual({ t: "roomCreated", code: "ABCDEF" });
    t.close();
  });
});
