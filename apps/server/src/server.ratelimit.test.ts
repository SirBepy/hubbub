import { describe, it, expect, afterEach } from "vitest";
import { WebSocket } from "ws";
import { ROOM_CODE_LENGTH } from "@hubbub/protocol";
import { createServer } from "./server.js";

// Valid shape, so it reaches the room lookup, but never generated in practice.
const MISSING_CODE = "Z".repeat(ROOM_CODE_LENGTH);

let handle: ReturnType<typeof createServer> | undefined;
afterEach(async () => await handle?.close());

const open = (port: number) =>
  new Promise<WebSocket>((res) => { const ws = new WebSocket(`ws://localhost:${port}`); ws.on("open", () => res(ws)); });
// joinRoom replies with either "joined" or "error" - wait for whichever comes first.
const nextReply = (ws: WebSocket) =>
  new Promise<any>((res, rej) => {
    const timer = setTimeout(() => rej(new Error("timeout waiting for joinRoom reply")), 4000);
    const h = (m: any) => {
      const msg = JSON.parse(m.toString());
      if (msg.t === "joined" || msg.t === "error") { clearTimeout(timer); ws.off("message", h); res(msg); }
    };
    ws.on("message", h);
  });
const nextOf = (ws: WebSocket, t: string) =>
  new Promise<any>((res, rej) => {
    const timer = setTimeout(() => rej(new Error(`timeout ${t}`)), 4000);
    const h = (m: any) => { const msg = JSON.parse(m.toString()); if (msg.t === t) { clearTimeout(timer); ws.off("message", h); res(msg); } };
    ws.on("message", h);
  });
const join = async (port: number, code: string, name: string) => {
  const ws = await open(port);
  ws.send(JSON.stringify({ t: "joinRoom", code, name, colorId: 0, emoji: "🐱" }));
  const reply = await nextReply(ws);
  ws.close();
  return reply;
};

describe("join rate limiting", () => {
  it("throttles a per-IP join flood while attempts within budget still succeed", async () => {
    handle = createServer(0, {}, { perIp: { max: 3, windowMs: 60_000 } });
    const port = (handle.wss.address() as { port: number }).port;
    const screen = await open(port);
    screen.send(JSON.stringify({ t: "createRoom" }));
    const created = await nextOf(screen, "roomCreated");

    const replies = [];
    for (let i = 0; i < 4; i++) replies.push(await join(port, created.code, `p${i}`));

    expect(replies.slice(0, 3).every((r) => r.t === "joined")).toBe(true);
    expect(replies[3].t).toBe("error");
    expect(replies[3].code).toBe("rate_limited");
  });

  it("throttles repeated fails against one code without blocking a fresh valid join", async () => {
    handle = createServer(0, {}, { perCode: { max: 2, windowMs: 60_000 }, perIp: { max: 100, windowMs: 60_000 } });
    const port = (handle.wss.address() as { port: number }).port;

    const fails = [];
    for (let i = 0; i < 3; i++) fails.push(await join(port, MISSING_CODE, `p${i}`));
    expect(fails[0].code).toBe("no_room");
    expect(fails[1].code).toBe("no_room");
    expect(fails[2].code).toBe("rate_limited");

    const screen = await open(port);
    screen.send(JSON.stringify({ t: "createRoom" }));
    const created = await nextOf(screen, "roomCreated");
    const ok = await join(port, created.code, "real player");
    expect(ok.t).toBe("joined");
  });
});
