import { DurableObject } from "cloudflare:workers";

interface RateLimitConfig { max: number; windowMs: number; }

// Real thresholds, same as apps/server/src/server.ts's DEFAULT_PER_IP/DEFAULT_PER_CODE.
const DEFAULT_PER_IP: RateLimitConfig = { max: 20, windowMs: 60_000 };
// Covers a debounced live-search box across several phones sharing one NAT'd IP, without
// letting a single client hammer the third-party Deezer API.
const DEFAULT_DEEZER: RateLimitConfig = { max: 60, windowMs: 60_000 };

// Sliding window via a per-key timestamp list, pruned on each hit - same algorithm as
// apps/server/src/server.ts's createLimiter, just called over RPC instead of in-process.
function hit(hits: Map<string, number[]>, key: string, now: number, cfg: RateLimitConfig): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < cfg.windowMs);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > cfg.max;
}

/** Single global instance (env.RATE_LIMITER.idFromName("global")) - the only actor that sees
 * traffic spread across every room code, which a per-room RoomDO structurally cannot. Per-code
 * failed-join counting stays inside RoomDO instead, since a code's failures are already scoped
 * to that DO. In-memory only: an idle eviction resets budgets, same as a Node process restart. */
export class RateLimiterDO extends DurableObject {
  private ipCreate = new Map<string, number[]>();
  private ipJoin = new Map<string, number[]>();
  private ipDeezer = new Map<string, number[]>();

  async checkCreate(ip: string, config: RateLimitConfig = DEFAULT_PER_IP): Promise<boolean> {
    return hit(this.ipCreate, ip, Date.now(), config);
  }

  async checkJoin(ip: string, config: RateLimitConfig = DEFAULT_PER_IP): Promise<boolean> {
    return hit(this.ipJoin, ip, Date.now(), config);
  }

  async checkDeezer(ip: string, config: RateLimitConfig = DEFAULT_DEEZER): Promise<boolean> {
    return hit(this.ipDeezer, ip, Date.now(), config);
  }
}
