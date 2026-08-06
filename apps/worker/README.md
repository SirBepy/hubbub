# @hubbub/worker

A Cloudflare Worker plus one Durable Object per room, implementing the same relay protocol
as `apps/server` (both consume `@hubbub/relay` - the logic never forks between the two).

## Run it locally

No Cloudflare account is required for any of this.

1. Build the web app once so the Worker has static assets to serve:
   `pnpm --filter @hubbub/web build`
2. From `apps/worker`: `pnpm dev` - starts `wrangler dev` on port 8787 against local
   Miniflare/workerd, serving the app and the relay from one origin
   (`http://localhost:8787`).
3. To exercise it against `apps/web`'s dev server instead of the built assets, point the
   web app's `VITE_SERVER_URL` at `ws://localhost:8787`.

`pnpm build` (`wrangler deploy --dry-run --outdir dist`) bundles the Worker and validates the
assets/Durable Object bindings without publishing anything or requiring `wrangler login`.

## Testing

`pnpm test` runs the integration suite inside real workerd via
`@cloudflare/vitest-pool-workers` (see `vitest.config.ts`). This package pins `vitest@^4.1.0`
and `vite@^7`, separate from the rest of the monorepo's `vitest@^2` - the pool has an
internal-API dependency on Vitest 4, so it cannot share the root `vitest.config.ts`/version.
The root `pnpm test` runs this suite too, via the `test:worker` script.

## What's implemented

- One `RoomDO` Durable Object per room, addressed by `env.ROOM.idFromName(code)`.
- WebSocket Hibernation API (`state.acceptWebSocket`, `webSocketMessage`/`Close`/`Error`) -
  no naive `addEventListener("message")`, so an idle room holds no billed DO duration.
  Per-socket routing state lives in `ws.serializeAttachment()`, not an in-memory map, so it
  survives eviction; `state.getWebSockets()` re-resolves the live sockets on wake.
  `test/hibernation.test.ts` forces a real eviction (`evictDurableObject`) and asserts both
  state rehydration and that pre-eviction sockets keep working.
- Room state lives in `ctx.storage`, written from `@hubbub/relay`'s `Room.snapshot()` and
  rebuilt with `Room.fromSnapshot()`.
- A second Durable Object, `RateLimiterDO` (single instance, `idFromName("global")`), holds
  the per-IP sliding-window counters for room creation and joins, because a per-room DO
  structurally cannot see a flood spread across many room codes. Per-code failed-join
  counting stays inside each `RoomDO` instead, since a code's failures are already scoped to
  that DO.
- `GET /room/:code` 404s (or 429s once a code's failure budget is spent) before any WebSocket
  upgrade, exactly like `apps/server`.
- Static assets for `apps/web` are served from the same Worker via the Workers Assets
  binding (`assets.directory` in `wrangler.jsonc`), so the app and the relay share one origin.

## Remaining steps to actually deploy (a human, by hand)

1. Create a Cloudflare account (free tier is enough) if one doesn't exist yet.
2. `wrangler login` from `apps/worker` to authenticate the CLI.
3. Pick the account's `workers.dev` subdomain in the Cloudflare dashboard the first time you
   deploy from that account - after that it's fixed.
4. `wrangler deploy` - publishes at `https://hubbub.<your-subdomain>.workers.dev`
   (`wrangler.jsonc`'s `"name"` is the only thing to change for a different Worker name; a
   later custom domain needs a DNS record plus a `routes` entry in `wrangler.jsonc`, nothing
   in the code).
5. Point the deployed `apps/web`'s `VITE_SERVER_URL` build-time env var at
   `wss://hubbub.<your-subdomain>.workers.dev` and rebuild/redeploy the web app - this is the
   one-line client-side change the design calls for.
6. No secrets are used by this Worker today; none to set.
