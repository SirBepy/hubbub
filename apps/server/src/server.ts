import { createServer as createHttpServer, type IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer, type WebSocket } from "ws";
import { parseClientMessage, type ServerMessage } from "@hubbub/protocol";
import { newToken } from "@hubbub/protocol/tokens";
import { hit, type RateLimitConfig } from "@hubbub/protocol/rate-limit";
import { gameSummaries, type GameRegistry } from "@hubbub/sdk";
import { getSettingsSchema } from "@hubbub/games-manifest/settings";
import { createLogger, toCatalog, type LogLevel, type RelayLogger } from "@hubbub/relay";
import { RoomManager } from "./rooms.js";

// LOG_LEVEL=debug also emits per-gameStatePush lines (noisy for a tickRateHz game); default
// stays "info" so a hosted deploy never pays for that unless explicitly asked.
function defaultLogger(): RelayLogger {
  const level: LogLevel = process.env.LOG_LEVEL === "debug" ? "debug" : "info";
  return createLogger(level, (line) => console.log(line));
}

export interface JoinRateLimitOptions { perIp?: RateLimitConfig; perCode?: RateLimitConfig; }

// Real thresholds (design spec "Room codes and abuse"). Injectable so tests can throttle
// without firing 20+ real messages from the loopback address they all share.
const DEFAULT_PER_IP: RateLimitConfig = { max: 20, windowMs: 60_000 };
const DEFAULT_PER_CODE: RateLimitConfig = { max: 10, windowMs: 60_000 };
const RATE_LIMIT_MESSAGE = "Too many join attempts. Try again shortly.";

// In-memory per-key timestamp lists, reset on restart is fine: rooms are already ephemeral
// with no persistence layer to match.
function createLimiter(config: RateLimitConfig) {
  const hits = new Map<string, number[]>();
  return (key: string, now: number): boolean => {
    const recent = hit(hits.get(key) ?? [], now, config);
    hits.set(key, recent);
    return recent.length > config.max;
  };
}

// Cloudflare's proxy makes every connection share its own address; CF-Connecting-IP carries
// the real client IP there. x-forwarded-for is the generic-proxy fallback.
function clientIp(req: IncomingMessage): string {
  const cf = req.headers["cf-connecting-ip"];
  if (typeof cf === "string" && cf) return cf;
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff) return xff.split(",")[0]!.trim();
  return req.socket.remoteAddress ?? "unknown";
}

function roomCodeFromUrl(url: string | undefined): string | null {
  const match = (url ?? "").split("?")[0].match(/^\/room\/([^/]+)$/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function createServer(
  port: number,
  games: GameRegistry,
  rateLimit: JoinRateLimitOptions = {},
  logger: RelayLogger = defaultLogger(),
  settingsSchema: (gameId: string) => ReturnType<typeof getSettingsSchema> = getSettingsSchema,
) {
  const wss = new WebSocketServer({ noServer: true });
  // Separate counters for POST /api/rooms vs the /room/:code upgrade: a screen's own room
  // creation must not eat into the budget the join-flood limiter guards.
  const ipLimitedCreate = createLimiter(rateLimit.perIp ?? DEFAULT_PER_IP);
  const ipLimitedJoin = createLimiter(rateLimit.perIp ?? DEFAULT_PER_IP);
  const codeLimited = createLimiter(rateLimit.perCode ?? DEFAULT_PER_CODE);
  const rooms = new RoomManager(toCatalog(games, gameSummaries(games), settingsSchema), { next: newToken }, logger);
  // connId -> live socket. Only @hubbub/relay's Room decides WHO is in a room's broadcast set
  // (room.connIds()); this map exists purely to resolve an opaque connId to something sendable.
  const sockets = new Map<string, WebSocket>();

  const send = (ws: WebSocket, msg: ServerMessage) => ws.send(JSON.stringify(msg));
  function route(code: string, outbound: { to: "all" | "conn"; connId?: string; msg: ServerMessage }[]) {
    const room = rooms.get(code);
    for (const o of outbound) {
      if (o.to === "all") {
        for (const connId of room?.connIds() ?? []) {
          const ws = sockets.get(connId);
          if (ws) send(ws, o.msg);
        }
      } else {
        const ws = o.connId ? sockets.get(o.connId) : undefined;
        if (ws) send(ws, o.msg);
      }
    }
  }

  // Cloud deploys serve the web app and this relay from the same origin, so CORS only bites
  // in local dev (apps/web on 5175 vs server on 7787). "*" is fine: unauthenticated, no cookies.
  const CORS_HEADERS = {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type",
  };

  // POST /api/rooms (allocate + return the code) and the /room/:code upgrade gate live on one
  // http.Server in front of the noServer WebSocketServer - a Durable Object is addressed by
  // name at connect time, so the code must be resolvable before the WS handshake completes.
  const http = createHttpServer((req, res) => {
    if (req.url === "/api/rooms" && req.method === "OPTIONS") {
      res.writeHead(204, CORS_HEADERS);
      res.end();
      return;
    }
    if (req.method === "POST" && req.url === "/api/rooms") {
      if (ipLimitedCreate(clientIp(req), Date.now())) {
        res.writeHead(429, { "content-type": "application/json", ...CORS_HEADERS });
        res.end(JSON.stringify({ message: RATE_LIMIT_MESSAGE }));
        return;
      }
      const code = rooms.createRoom();
      res.writeHead(201, { "content-type": "application/json", ...CORS_HEADERS });
      res.end(JSON.stringify({ code }));
      return;
    }
    res.writeHead(404);
    res.end();
  });

  // Connection: close (not just destroy()) so the client's HTTP parser has an explicit end
  // for the bodyless response instead of waiting on the socket teardown to infer it.
  function rejectUpgrade(socket: Duplex, status: number, statusText: string) {
    socket.write(`HTTP/1.1 ${status} ${statusText}\r\nConnection: close\r\n\r\n`);
    socket.destroy();
  }

  http.on("upgrade", (req, socket, head) => {
    const code = roomCodeFromUrl(req.url);
    if (!code) { rejectUpgrade(socket, 404, "Not Found"); return; }
    const now = Date.now();
    if (ipLimitedJoin(clientIp(req), now)) { rejectUpgrade(socket, 429, "Too Many Requests"); return; }
    if (!rooms.has(code)) {
      // Per-code counts only failures, so guessing at one room throttles harder than a real join.
      const status = codeLimited(code, now) ? 429 : 404;
      rejectUpgrade(socket, status, status === 429 ? "Too Many Requests" : "Not Found");
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
  });
  http.listen(port);

  wss.on("connection", (ws, req: IncomingMessage) => {
    const code = roomCodeFromUrl(req.url)!;
    const connId = newToken();
    sockets.set(connId, ws);

    ws.on("message", async (raw) => {
      let msg;
      try { msg = parseClientMessage(raw.toString()); }
      catch { send(ws, { t: "error", code: "bad_message", message: "Invalid message" }); return; }
      const room = rooms.get(code);
      if (!room) return;
      const outbound = await room.handleMessage(connId, msg, Date.now());
      route(code, outbound);
    });

    ws.on("close", () => {
      sockets.delete(connId);
      const room = rooms.get(code);
      if (!room) return;
      const outbound = room.handleDisconnect(connId);
      route(code, outbound);
    });
  });

  return {
    server: http,
    close: () => new Promise<void>((resolve) => {
      wss.clients.forEach((c) => c.terminate());
      wss.close();
      http.close(() => resolve());
    }),
  };
}
