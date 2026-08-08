import { describe, it, expect, afterEach } from "vitest";
import { WebSocket } from "ws";
import { ROOM_CODE_LENGTH, createRoomHttp, roomSocketUrl } from "@hubbub/protocol";
import { noopLogger } from "@hubbub/relay";
import { createServer } from "./server.js";

// Valid shape, so it reaches the room lookup, but never generated in practice.
const MISSING_CODE = "Z".repeat(ROOM_CODE_LENGTH);

let handle: ReturnType<typeof createServer> | undefined;
afterEach(async () => await handle?.close());

const open = (url: string) =>
  new Promise<WebSocket>((res) => { const ws = new WebSocket(url); ws.on("open", () => res(ws)); });
const nextOf = (ws: WebSocket, t: string) =>
  new Promise<any>((res, rej) => {
    const timer = setTimeout(() => rej(new Error(`timeout waiting for "${t}"`)), 4000);
    const h = (m: any) => { const msg = JSON.parse(m.toString()); if (msg.t === t) { clearTimeout(timer); ws.off("message", h); res(msg); } };
    ws.on("message", h);
  });

// Unknown/rate-limited codes now fail at the WS handshake itself (HTTP layer, before "connection"
// ever fires), so ws emits "unexpected-response" with the rejection status instead of an open
// socket. A successful attempt still round-trips joinRoom -> joined like before.
type JoinAttempt = { ok: true } | { ok: false; status: number };
const attemptJoin = (base: string, code: string, name: string): Promise<JoinAttempt> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout waiting for join attempt")), 4000);
    const ws = new WebSocket(roomSocketUrl(base, code));
    ws.on("unexpected-response", (_req, res) => { clearTimeout(timer); resolve({ ok: false, status: res.statusCode! }); });
    ws.on("error", () => {}); // the rejected upgrade also fires a generic error; the response above already resolved
    ws.on("open", () => {
      ws.send(JSON.stringify({ t: "joinRoom", name, colorId: 0, emoji: "🐱" }));
      ws.on("message", (m) => {
        const msg = JSON.parse(m.toString());
        if (msg.t === "joined") { clearTimeout(timer); ws.close(); resolve({ ok: true }); }
      });
    });
  });

describe("join rate limiting", () => {
  it("throttles a per-IP join flood while attempts within budget still succeed", async () => {
    // max is 4, not 3: the screen's own /room/:code upgrade shares this same per-IP counter
    // (the limiter can't yet tell attachScreen from joinRoom - both are just an upgrade to the
    // same URL), so it spends 1 of the budget before any of the 4 controller attempts below.
    handle = createServer(0, {}, { perIp: { max: 4, windowMs: 60_000 } }, noopLogger);
    const port = (handle.server.address() as { port: number }).port;
    const base = `ws://localhost:${port}`;
    const code = await createRoomHttp(base);
    const screen = await open(roomSocketUrl(base, code));
    screen.send(JSON.stringify({ t: "attachScreen" }));
    await nextOf(screen, "roomCreated");

    const attempts: JoinAttempt[] = [];
    for (let i = 0; i < 4; i++) attempts.push(await attemptJoin(base, code, `p${i}`));

    expect(attempts.slice(0, 3).every((r) => r.ok)).toBe(true);
    expect(attempts[3]).toEqual({ ok: false, status: 429 });
  });

  it("throttles repeated fails against one code without blocking a fresh valid join", async () => {
    handle = createServer(0, {}, { perCode: { max: 2, windowMs: 60_000 }, perIp: { max: 100, windowMs: 60_000 } }, noopLogger);
    const port = (handle.server.address() as { port: number }).port;
    const base = `ws://localhost:${port}`;

    const fails: JoinAttempt[] = [];
    for (let i = 0; i < 3; i++) fails.push(await attemptJoin(base, MISSING_CODE, `p${i}`));
    expect(fails[0]).toEqual({ ok: false, status: 404 });
    expect(fails[1]).toEqual({ ok: false, status: 404 });
    expect(fails[2]).toEqual({ ok: false, status: 429 });

    const code = await createRoomHttp(base);
    const screen = await open(roomSocketUrl(base, code));
    screen.send(JSON.stringify({ t: "attachScreen" }));
    await nextOf(screen, "roomCreated");
    const ok = await attemptJoin(base, code, "real player");
    expect(ok).toEqual({ ok: true });
  });
});
