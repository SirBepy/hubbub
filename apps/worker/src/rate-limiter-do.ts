import { DurableObject } from "cloudflare:workers";

interface RateLimitConfig { max: number; windowMs: number; }

// Real thresholds, same as apps/server/src/server.ts's DEFAULT_PER_IP/DEFAULT_PER_CODE.
const DEFAULT_PER_IP: RateLimitConfig = { max: 20, windowMs: 60_000 };
// Covers a debounced live-search box across several phones sharing one NAT'd IP, without
// letting a single client hammer the third-party Deezer API.
const DEFAULT_DEEZER: RateLimitConfig = { max: 60, windowMs: 60_000 };

// Sliding window over one timestamp list, pruned on each hit - same algorithm as
// apps/server/src/server.ts's createLimiter, just called over RPC instead of in-process.
function hit(hits: number[], now: number, cfg: RateLimitConfig): number[] {
  const recent = hits.filter((t) => now - t < cfg.windowMs);
  recent.push(now);
  return recent;
}

/** One instance per client IP (getByName(`ip:${ip}`)), so it sees that IP across every room code,
 * which a per-room RoomDO cannot. Per-code failures stay in RoomDO, already scoped to that DO.
 * In-memory only: an idle eviction resets budgets, same as a Node process restart. */
export class RateLimiterDO extends DurableObject {
  private createHits: number[] = [];
  private joinHits: number[] = [];
  private deezerHits: number[] = [];

  async checkCreate(config: RateLimitConfig = DEFAULT_PER_IP): Promise<boolean> {
    this.createHits = hit(this.createHits, Date.now(), config);
    return this.createHits.length > config.max;
  }

  async checkJoin(config: RateLimitConfig = DEFAULT_PER_IP): Promise<boolean> {
    this.joinHits = hit(this.joinHits, Date.now(), config);
    return this.joinHits.length > config.max;
  }

  async checkDeezer(config: RateLimitConfig = DEFAULT_DEEZER): Promise<boolean> {
    this.deezerHits = hit(this.deezerHits, Date.now(), config);
    return this.deezerHits.length > config.max;
  }
}
