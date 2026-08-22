@~/.claude/snippets/full-auto.md

## Project

Hubbub - an open-source, self-hostable party-game platform: a big screen (TV/laptop browser) runs the game, phones are the controllers (join via room code or QR). Real-time. Runs in a zero-cost local LAN mode and a hosted cloud mode. A framework many games are built on top of (Jackbox, but self-hostable and extensible).

Type: other (TypeScript pnpm + Turborepo monorepo: React/Vite web apps + Node WS server + Electron host)
Deploy: other (cloud = hosted server + screen over wss; local = Electron host app sent to friends)

## Status

Scaffolded, deployed and playable: 6 apps, 6 packages, live at hubbub.tabsxlabs.workers.dev (Cloudflare, free plan). The design specs in `docs/superpowers/specs/` are history/rationale now, not the current source of truth - `packages/games-manifest/scripts/generate.mjs` and this file are.

## Structure

```
/apps
  screen        big-screen renderer, authoritative game state (Vite/React)
  controller    phone PWA, dumb input widgets (Vite/React)
  web           cloud entry point; role-detects screen vs controller by viewport/room code,
                builds the static assets the worker serves
  server        local-LAN Node WS relay (tsx/ws)
  worker        cloud relay: Cloudflare Worker + Durable Objects (RoomDO, RateLimiterDO)
  host-desktop  Electron wrapper; bundles screen+controller, serves them over LAN
/packages
  protocol       transport iface + Zod schemas + reconnect tokens
  sdk            GameDefinition runtime (server logic / screen / controller contract)
  ui             shared component/token library
  relay          transport-agnostic room logic shared by server + worker
  games          ONLY tictactoe + ultimate-tictactoe live here
  games-manifest @hubbub/games-manifest, the REAL roster: tap-race, music-guesser and
                 split-opinions are SEPARATE sibling repos - grepping packages/games/*
                 alone misses 3 of 5 games. src/{logics,lazy,settings}.ts are GENERATED
                 by scripts/generate.mjs (and gitignored - they only exist after an
                 install), which omits any sibling repo absent on disk; register a game
                 in the generator, never by editing its output
```

## Commands

- Dev: `pnpm dev` (everything) or `pnpm dev:all` (server+web+screen+controller only)
- Verify floor: `pnpm -w typecheck`, `pnpm -w test`, `pnpm -w build` - there is no lint script
- Scoped typecheck: `pnpm --filter <pkg> typecheck` - never add `--concurrency`, it reaches `tsc` and errors TS5023
- Scoped test: no package has its own `test` script except `@hubbub/worker`; everything else runs off the root `vitest.config.ts`, so scope by path instead: `pnpm exec vitest run apps/server`
- Install: bare `pnpm install` is blocked by a global hook - use `corepack pnpm install`
- Electron packaging: `pnpm host:build`, `pnpm host:dev`, `pnpm host:package`

## Architecture

Full design in the spec above. Load-bearing invariants a session must not violate:

- **Transport is a swappable interface** (`packages/protocol`). WebSocket (`ws`) is the default impl; WebRTC DataChannel is a future impl behind the SAME interface. Game code and SDK must NEVER import a concrete transport - only the interface.
- **The phone is a dumb controller; the screen renders everything.** Inputs pay one-way latency (phone -> screen), never a round trip.
- **The screen is authoritative for EVERY game** (changed 2026-08-05, commit `0d04fe6`). The server is relay, membership, reconnect and signaling only; it never runs a reducer. Real-time games still declare `tickRateHz` for their 60fps loop, but that is no longer an authority switch. See `docs/superpowers/specs/2026-08-05-hubbub-cloud-hosting-and-game-distribution-design.md`.
- **A game implements only three parts** (`GameDefinition` in `packages/sdk`): server logic, screen view, controller view. The framework owns rooms, join/leave, state sync, input routing, reconnection, lobby, QR, and local/cloud transport.
- **Input = logical actions, never raw keys.** Games bind to actions (`jump`, `select`); the framework maps touch widgets / keyboard / gamepad onto them. This is what makes keyboard+gamepad support and input tests cheap later.
- **Local vs cloud is one config flag** (server endpoint + QR target). Game code is identical in both modes.
- **Reconnect tokens** per player so a WiFi blip reclaims the slot (designed in, not retrofitted).

## Rules

- **Music/audio source is Deezer, never Spotify.** Spotify's Developer Policy bans games and nulls `preview_url` for new apps. Deezer = no auth, free 30s MP3 via a hidden `<audio>` tag. YouTube IFrame is an allowed secondary mode but forces a *visible* player.
- **Before building the Spotify Stats game (#3): verify the "no games" policy risk first** - it may apply even to read-only stats. Does not block the framework.
- Controller is web/PWA only. Native is deferred and, if ever needed, is a Capacitor wrap of the same controller code - never a separate codebase.
- `needs.motion` games require a secure context (HTTPS) on LAN; touch/button games work on plain-HTTP LAN. Decide the local-cert strategy before Phase 4.
- **License: MIT.** Copyright holder in `LICENSE` is a placeholder (`Joe`) - swap for the real legal/display name before public release.
- **Offline LAN = no CDNs.** Bundle Phosphor icons, fonts, and all assets into the apps; never CDN-load. Local mode has no internet. This overrides the usual global CDN habit.
- **No fixed player cap.** Each game declares `meta.maxPlayers`; the framework supplies a default.
- **Screen app holds a Wake Lock** so the display doesn't sleep mid-game.
- Product name is the working codename `hubbub` until a real name is chosen before public launch.
- Full-auto: yes (this repo imports full-auto.md - proceed across routine decisions without asking; hard stops still hold).
