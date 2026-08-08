export interface RateLimitConfig { max: number; windowMs: number; }

// Sliding window over one timestamp list, pruned on each hit. Shared by apps/server's
// Map-backed limiter and apps/worker's per-IP Durable Object arrays - only storage differs.
export function hit(hits: number[], now: number, cfg: RateLimitConfig): number[] {
  const recent = hits.filter((t) => now - t < cfg.windowMs);
  recent.push(now);
  return recent;
}
