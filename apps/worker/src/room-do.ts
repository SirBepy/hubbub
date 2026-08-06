import { DurableObject } from "cloudflare:workers";
import { parseClientMessage } from "@hubbub/protocol";
import { Room, type Outbound, type RoomSnapshot } from "@hubbub/relay";
import { catalog } from "./catalog.js";
import { webCryptoTokens } from "./tokens.js";
import type { WorkerEnv } from "./env.js";

interface RateLimitConfig { max: number; windowMs: number; }
const DEFAULT_PER_CODE: RateLimitConfig = { max: 10, windowMs: 60_000 };

interface ConnAttachment { connId: string; }

/** One Durable Object instance IS one room, addressed by env.ROOM.idFromName(code). Room state
 * lives in ctx.storage (design constraint 4); `this.room` is only a same-wake memoization,
 * rebuilt from storage on every cold start - hibernation evicts it, never the storage. */
export class RoomDO extends DurableObject<WorkerEnv> {
  private room: Room | undefined;
  // Per-code failed-join counter: naturally scoped to this one DO, so it needs no global
  // coordination the way per-IP limiting does (see RateLimiterDO). In-memory only, like
  // apps/server's equivalent counter.
  private codeFails: number[] = [];

  /** Idempotent reservation: false means this code was already taken (the HTTP handler's signal
   * to retry with a fresh code), true means this DO now holds a freshly created room. */
  async create(code: string): Promise<boolean> {
    if (await this.ctx.storage.get<RoomSnapshot>("room")) return false;
    const room = Room.create(code, catalog, webCryptoTokens);
    await this.ctx.storage.put("room", room.snapshot());
    return true;
  }

  private async getRoom(): Promise<Room | null> {
    if (this.room) return this.room;
    const snap = await this.ctx.storage.get<RoomSnapshot>("room");
    if (!snap) return null;
    this.room = Room.fromSnapshot(snap, catalog, webCryptoTokens);
    return this.room;
  }

  /** Handles the /room/:code WS upgrade forwarded from the top-level Worker. Rejects with
   * 404/429 before ever calling acceptWebSocket, exactly like the Node server's upgrade gate. */
  async fetch(request: Request): Promise<Response> {
    const room = await this.getRoom();
    if (!room) {
      const now = Date.now();
      const recent = this.codeFails.filter((t) => now - t < DEFAULT_PER_CODE.windowMs);
      recent.push(now);
      this.codeFails = recent;
      return new Response(null, { status: recent.length > DEFAULT_PER_CODE.max ? 429 : 404 });
    }
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected websocket", { status: 400 });
    }
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    const attachment: ConnAttachment = { connId: crypto.randomUUID() };
    server.serializeAttachment(attachment);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const room = await this.getRoom();
    if (!room) return;
    const { connId } = ws.deserializeAttachment() as ConnAttachment;
    let msg;
    try {
      msg = parseClientMessage(typeof message === "string" ? message : new TextDecoder().decode(message));
    } catch {
      ws.send(JSON.stringify({ t: "error", code: "bad_message", message: "Invalid message" }));
      return;
    }
    const outbound = await room.handleMessage(connId, msg, Date.now());
    await this.ctx.storage.put("room", room.snapshot());
    this.route(room, outbound);
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const room = await this.getRoom();
    if (!room) return;
    const { connId } = ws.deserializeAttachment() as ConnAttachment;
    const outbound = room.handleDisconnect(connId);
    await this.ctx.storage.put("room", room.snapshot());
    this.route(room, outbound);
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.webSocketClose(ws);
  }

  /** Resolves each Outbound's symbolic destination against the sockets hibernation actually woke
   * with (ctx.getWebSockets()) - never an in-memory connId->socket map, which eviction would
   * silently empty (design constraint 3). */
  private route(room: Room, outbound: Outbound[]): void {
    const byConnId = new Map<string, WebSocket>();
    for (const ws of this.ctx.getWebSockets()) {
      const att = ws.deserializeAttachment() as ConnAttachment | null;
      if (att?.connId) byConnId.set(att.connId, ws);
    }
    for (const o of outbound) {
      const payload = JSON.stringify(o.msg);
      if (o.to === "all") {
        for (const connId of room.connIds()) byConnId.get(connId)?.send(payload);
      } else {
        byConnId.get(o.connId)?.send(payload);
      }
    }
  }
}
