import { describe, it, expect, afterEach } from "vitest";
import { createServer, type Server } from "node:http";
import { createRoomHttp, roomSocketUrl } from "./http.js";

let server: Server | undefined;
afterEach(() => server?.close());

describe("createRoomHttp", () => {
  it("POSTs to /api/rooms against the http-translated base and returns the code", async () => {
    server = createServer((req, res) => {
      if (req.method === "POST" && req.url === "/api/rooms") {
        res.writeHead(201, { "content-type": "application/json" });
        res.end(JSON.stringify({ code: "ABCD" }));
      } else {
        res.writeHead(404);
        res.end();
      }
    });
    await new Promise<void>((r) => server!.listen(0, r));
    const port = (server!.address() as { port: number }).port;
    const code = await createRoomHttp(`ws://localhost:${port}`);
    expect(code).toBe("ABCD");
  });

  it("throws on a non-ok response", async () => {
    server = createServer((_req, res) => { res.writeHead(429); res.end(); });
    await new Promise<void>((r) => server!.listen(0, r));
    const port = (server!.address() as { port: number }).port;
    await expect(createRoomHttp(`ws://localhost:${port}`)).rejects.toThrow();
  });
});

describe("roomSocketUrl", () => {
  it("appends /room/:code without changing the scheme", () => {
    expect(roomSocketUrl("ws://localhost:7787", "ABCD")).toBe("ws://localhost:7787/room/ABCD");
    expect(roomSocketUrl("wss://cloud.example.com", "WXYZ")).toBe("wss://cloud.example.com/room/WXYZ");
  });
});
