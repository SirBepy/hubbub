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

1. Create a Cloudflare account, then subscribe to **Workers Paid** (about 5 USD/month). The free
   tier does NOT include Durable Objects, and the relay is entirely Durable Objects, so a free
   account cannot run this.
2. Register `hubbub.tv` (chosen 2026-08-07) and add it as a zone on that same account.
   Registering it through Cloudflare Registrar puts it on Cloudflare DNS with no transfer step.
   `wrangler.jsonc`'s `routes` entry already points at it; **deploying before the zone exists
   will fail.** Delete that block to fall back to the `workers.dev` subdomain.
3. `wrangler login` from `apps/worker` to authenticate the CLI. This opens a browser consent page.
4. `wrangler deploy`.

There is deliberately **no client-side step**. `apps/web` resolves its relay endpoint from the
origin it was served from in production builds (`apps/web/src/config-resolve.ts`), and the Worker
serves the app and the relay from that one origin, so a plain `pnpm build` is correct for any
hostname. Setting `VITE_SERVER_URL` is only for pointing a build at some OTHER backend; it is not
part of a normal deploy. Defaulting it to a hardcoded port was a real bug, fixed in `cb71cd3`.

No secrets are used by this Worker today, so there are none to set. `VITE_STUN_URL` optionally
overrides the default STUN server for the WebRTC tier.

Note for local runs on Joe's machine: port 8787 is occupied by an unrelated process, so
`wrangler dev --port 8788` is the working invocation there.
