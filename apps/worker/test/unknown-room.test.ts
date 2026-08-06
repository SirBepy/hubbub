import { describe, it, expect, afterEach } from "vitest";
import { SELF, reset } from "cloudflare:test";

afterEach(async () => { await reset(); });

describe("unknown room code", () => {
  it("rejects with 404 before any WebSocket upgrade completes", async () => {
    const res = await SELF.fetch("http://worker.local/room/ZZZZ", { headers: { Upgrade: "websocket" } });
    expect(res.status).toBe(404);
    expect(res.webSocket).toBeNull();
  });

  it("OPTIONS /api/rooms returns 204 with CORS headers", async () => {
    const res = await SELF.fetch("http://worker.local/api/rooms", { method: "OPTIONS" });
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });
});
