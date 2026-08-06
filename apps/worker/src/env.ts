import type { RateLimiterDO } from "./rate-limiter-do.js";
import type { RoomDO } from "./room-do.js";

export interface WorkerEnv {
  ROOM: DurableObjectNamespace<RoomDO>;
  RATE_LIMITER: DurableObjectNamespace<RateLimiterDO>;
  ASSETS: Fetcher;
}

// Merges into the ambient Cloudflare.Env namespace so cloudflare:test's `env` export (typed as
// Cloudflare.Env) sees these bindings too, without generating/committing a wrangler-types file.
// Named WorkerEnv (not Env) to avoid self-referential shadowing inside this same augmentation.
declare global {
  namespace Cloudflare {
    interface Env extends WorkerEnv {}
  }
}
