import { newRoomCode } from "@hubbub/protocol/tokens";
import type { WorkerEnv } from "./env.js";

export { RoomDO } from "./room-do.js";
export { RateLimiterDO } from "./rate-limiter-do.js";

// Mirrors apps/server/src/server.ts's CORS_HEADERS - "*" is fine (unauthenticated, no cookies).
const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
};
const RATE_LIMIT_MESSAGE = "Too many join attempts. Try again shortly.";

// Behind Cloudflare every connection shares the proxy's own address; CF-Connecting-IP carries
// the real client IP (req.socket.remoteAddress is meaningless here, unlike the Node server).
function clientIp(request: Request): string {
  return request.headers.get("CF-Connecting-IP") ?? "unknown";
}

function roomCodeFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/room\/([^/]+)$/);
  return match ? decodeURIComponent(match[1]) : null;
}

const DEEZER_ORIGIN = "https://api.deezer.com";
// Exhaustive: only what a game's setup() actually calls. Matched with ^...$ against the fully
// decoded remainder, so no extra segment, "..", or non-digit id can ever sneak through.
const DEEZER_ALLOWED_PATHS = [
  /^search$/,
  /^track\/\d+$/,
  /^album\/\d+$/,
  /^artist\/\d+$/,
  /^playlist\/\d+$/,
  /^chart$/,
  /^chart\/\d+$/,
];

// Destination is always the hardcoded DEEZER_ORIGIN; this only ever returns a path already
// proven to match the allowlist above, never anything steerable by the caller.
function deezerPathFromUrl(pathname: string): string | null {
  const match = pathname.match(/^\/proxy\/deezer\/(.+)$/);
  if (!match) return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(match[1]);
  } catch {
    return null;
  }
  return DEEZER_ALLOWED_PATHS.some((re) => re.test(decoded)) ? decoded : null;
}

async function handleDeezerProxy(request: Request, env: WorkerEnv, path: string): Promise<Response> {
  const limiter = env.RATE_LIMITER.get(env.RATE_LIMITER.idFromName("global"));
  if (await limiter.checkDeezer(clientIp(request))) {
    return new Response(JSON.stringify({ message: RATE_LIMIT_MESSAGE }), {
      status: 429,
      headers: { "content-type": "application/json", ...CORS_HEADERS },
    });
  }

  // Cache API keyed on the incoming (already-allowlisted) URL - Deezer metadata is effectively
  // static, so this avoids re-hitting the third party for repeat lookups (e.g. shared charts).
  const cache = caches.default;
  const cached = await cache.match(request);
  if (cached) return cached;

  const upstream = new URL(`${DEEZER_ORIGIN}/${path}`);
  upstream.search = new URL(request.url).search;
  // No client headers forwarded upstream, and nothing from the upstream response (cookies,
  // auth) is forwarded back - only the JSON body and a fresh content-type.
  const upstreamRes = await fetch(upstream.toString(), { method: "GET" });
  const body = await upstreamRes.text();
  const res = new Response(body, {
    status: upstreamRes.status,
    headers: { "content-type": "application/json", "cache-control": "public, max-age=3600", ...CORS_HEADERS },
  });
  // Awaited (not waitUntil'd): keeps the caching path simple with no request lifetime beyond
  // the response, at the cost of the write briefly delaying a cold-cache reply.
  await cache.put(request, res.clone());
  return res;
}

async function handleCreateRoom(request: Request, env: WorkerEnv): Promise<Response> {
  const limiter = env.RATE_LIMITER.get(env.RATE_LIMITER.idFromName("global"));
  if (await limiter.checkCreate(clientIp(request))) {
    return new Response(JSON.stringify({ message: RATE_LIMIT_MESSAGE }), {
      status: 429,
      headers: { "content-type": "application/json", ...CORS_HEADERS },
    });
  }
  // Collision retry, same shape as apps/server's RoomManager.createRoom(): RoomDO.create() is
  // the DO's own atomic check-and-reserve, so no separate exists()-then-create() race is possible.
  let code = newRoomCode();
  let stub = env.ROOM.get(env.ROOM.idFromName(code));
  while (!(await stub.create(code))) {
    code = newRoomCode();
    stub = env.ROOM.get(env.ROOM.idFromName(code));
  }
  return new Response(JSON.stringify({ code }), {
    status: 201,
    headers: { "content-type": "application/json", ...CORS_HEADERS },
  });
}

async function handleRoomUpgrade(request: Request, env: WorkerEnv, code: string): Promise<Response> {
  const limiter = env.RATE_LIMITER.get(env.RATE_LIMITER.idFromName("global"));
  if (await limiter.checkJoin(clientIp(request))) {
    return new Response(null, { status: 429 });
  }
  // Forwarding the live Request (Upgrade header intact) to the room's own DO - its fetch()
  // owns the 404/429-on-unknown-code check and the actual acceptWebSocket call.
  const stub = env.ROOM.get(env.ROOM.idFromName(code));
  return stub.fetch(request);
}

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/rooms" && request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    if (url.pathname === "/api/rooms" && request.method === "POST") {
      return handleCreateRoom(request, env);
    }
    if (url.pathname.startsWith("/proxy/deezer/")) {
      if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
      if (request.method !== "GET") return new Response(null, { status: 405, headers: CORS_HEADERS });
      const path = deezerPathFromUrl(url.pathname);
      if (!path) return new Response(null, { status: 404, headers: CORS_HEADERS });
      return handleDeezerProxy(request, env, path);
    }
    const code = roomCodeFromPath(url.pathname);
    if (code && request.headers.get("Upgrade") === "websocket") {
      return handleRoomUpgrade(request, env, code);
    }
    // Single origin: everything else is apps/web's built static app (Workers Assets binding).
    return env.ASSETS.fetch(request);
  },
};
