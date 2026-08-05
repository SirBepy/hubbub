# Hubbub - Cloud Hosting & Game Distribution Design

> Status: Approved design (2026-08-05). Supersedes parts of
> `2026-06-24-hubbub-party-game-framework-design.md` (see "Superseded decisions" below).
> Next step: implementation plan via writing-plans.

Extends the original framework spec with a real cloud deployment, a single-origin app,
screen authority for every game, third-party game distribution, and the security model
that distribution requires. Read the original spec first; this document assumes it.

---

## Superseded decisions

- **Authority model.** The original spec's "screen-authoritative for real-time,
  server-authoritative for turn-based" (`2026-06-24` doc, decisions log, and build order
  Phase 1/5) is replaced by **screen-authoritative for all games**. See Architecture ->
  Authority below.
- **Phase 5 (Cloud mode).** The original Phase 5 ("deploy server + screen (wss)") is
  replaced wholesale by the Migration path in this document: Cloudflare Workers + Durable
  Objects, one origin, sandboxed game distribution.

## Goals

- Remote play (screen and controllers on different networks) works reliably, at zero
  idle cost, on Cloudflare's free tier.
- Local LAN mode keeps working exactly as today, fully offline, no CDNs.
- Games become independently deployable artifacts, not platform-build dependencies.
- Third-party game code cannot compromise a player's session, token, or the platform DOM.

## Non-goals

- Native mobile controllers (unchanged: web/PWA only, Capacitor later if ever).
- Paid tiers, billing, or usage limits beyond staying inside the free tier.
- A game marketplace UI / discovery beyond a simple approved-catalogue list.
- Solving Spotify Stats' policy risk (tracked separately in the original spec).

## Architecture

### Deployment target

- **Cloudflare Workers + Durable Objects.** One DO instance per room; the DO holds room
  membership, the opaque state backup, and WebSocket connections for that room.
- **Static assets:** the merged app and approved game bundles serve via Cloudflare static
  assets (Workers Assets), pinned by content hash (see Security -> content pinning).
- **Free tier is the target.** Two billing facts drive the design:
  - Incoming WebSocket messages bill **20:1** against the Workers request quota.
  - Idle Durable Objects must cost no duration - **WebSocket Hibernation API**
    (`state.acceptWebSocket()`) is mandatory so a room with no traffic doesn't hold the DO
    awake between messages.
- Local LAN mode is unaffected: `apps/host-desktop/src/host.ts:25-62` keeps running its own
  `ws` server (`createWsServer`) and static file servers. Cloudflare is the cloud-mode
  backend only, swapped in behind the existing `ClientTransport` interface
  (`packages/protocol/src/transport.ts:10-16`), never a second transport type.

### One app, one origin

- `apps/screen` (port 5173) and `apps/controller` (port 5174) merge into one app on one
  origin with role routing. Today the screen has **no landing at all**: it auto-sends
  `createRoom` on mount (`apps/screen/src/App.tsx:68-93`) and the controller separately
  reads `?room=` off `location.search` (`apps/controller/src/App.tsx:22`).
- New entry behaviour:
  - Bare URL -> role-selection screen (host or join).
  - `?room=CODE` -> resolves straight to the controller role, pre-filled with the code.
  - A device heuristic (`matchMedia("(pointer: coarse)")` + viewport width) **preselects**
    the likely role. It never forces it: a phone can still choose "host on this screen",
    a laptop can still choose "join as controller". Preselection is a default cursor
    position, not a gate.
- Same-origin is also what avoids Chrome's Local Network Access permission prompt in LAN
  mode (a cross-origin fetch/WS from a public-looking page into a private-range host
  triggers it; same-origin same-app does not).
- `apps/screen` and `apps/controller` fold into one Vite app (working name `apps/web`) with
  two route-level entry components; `apps/host-desktop/src/static-server.ts` then serves one
  directory instead of two, and `apps/screen/src/config-resolve.ts:12-22` /
  `apps/controller/src/config.ts:1-2` collapse into one config-resolve module shared by both
  roles.

### Authority

- **The screen is authoritative for every game**, not just real-time ones. The game
  reducer (`GameLogic.onAction`, `onTimeout`, `nextDeadline`, per
  `packages/sdk/src/types.ts:62-76`) runs in the screen's process, driven by the screen's
  own event loop via `GameInstance` (`packages/sdk/src/runtime.ts`).
- The **server (Worker/DO in cloud, `ws` server locally) becomes relay + membership +
  reconnect + WebRTC signaling**. It routes `action` messages from controllers to the
  screen and pushes the resulting state back out; it never calls `onAction` itself.
- The screen pushes each resulting state to the room DO as an **opaque, untrusted backup
  blob** (`{ gameId, state }`, no interpretation) so a screen refresh can restore an
  in-progress game. The server never executes or validates game logic against this blob;
  it exists purely as a coldstore.
- Crash resilience is explicitly "nice to have, not important" (owner call). The backup is
  deliberately best-effort: fire-and-forget, no ack, no retry, coalesced (last write wins,
  latest state only - no history). If a backup write is lost, the room simply resumes at
  the last-received screen state, or restarts the game.
- This changes `apps/server/src/server.ts`'s role for turn-based games (currently
  `inst.applyAction` runs server-side, `server.ts:228-236`) and removes the room-owned
  timer (`server.ts:51-68`, see Blockers below).

### Game distribution

- A game ships as a **separately-deployed artifact**: a static JS module (reducer + screen
  view + controller view) plus a manifest entry, versioned and hash-pinned. Never bundled
  into the platform build.
- This extends the existing lazy-load mechanism rather than adding a second one. Today
  `packages/games-manifest/src/lazy.ts:25-48` dynamic-`import()`s each game's screen,
  controller, and logic from workspace packages resolved at the platform's own build time.
  The new mechanism replaces those workspace imports with `import()` of a URL pointing at
  the platform's self-hosted, content-hashed bundle for that game version. Only the
  registry entries change shape; the `loadGameScreen` / `loadGameController` call sites
  (`apps/screen`, `apps/controller`, soon the merged app) do not.
- The server-side eager registry (`packages/games-manifest/src/logics.ts:1-21`, used by
  `apps/server` and `apps/host-desktop` for `GAME_LOGICS`) goes away for cloud mode: with
  screen authority, the server no longer runs `logic.onAction`/`init` at all, so it has no
  need to import game logic eagerly. Local mode (see Parity below) still needs an eager,
  offline registry, so `logics.ts`'s role narrows to "local/Electron build only."
- Games are versioned and deployed independently of platform releases. A manifest entry
  carries `{ id, version, contentHash, entryUrl }`; the platform's approved catalogue is the
  list of manifest entries a human has signed off (see Security).

### Security

Load-bearing. Game code (both views and the reducer) is untrusted by construction once
distribution is decoupled from platform review at play time.

**Sandboxed iframe, mandatory.**
- Game views are browser modules that, under any distribution architecture, execute in the
  platform's own tab. Without isolation they can read `hubbub:token:<code>` and
  `hubbub:identity` from `localStorage`, hijack the shared WebSocket, exfiltrate data via
  `fetch`, and phish through the shell DOM.
- Fix: game code (screen view, controller view, and reducer) runs inside a
  **cross-origin sandboxed iframe** (`sandbox` attribute, served from a separate origin,
  e.g. `games.hubbub.app` vs the shell's `app.hubbub.app`), communicating with the platform
  shell only over `postMessage`. Cross-origin is what makes `localStorage`/cookie isolation
  actually hold; `sandbox` alone on a same-origin iframe does not isolate storage.

**Content-hash pinning, mandatory.**
- The platform **self-hosts** every approved game bundle; it never loads a game from an
  author-controlled URL at play time. An approved-then-swapped author URL is the documented
  Chrome-extension post-review compromise pattern (an extension passes store review, then
  the author's own update server later serves malicious code to already-installed users).
  Self-hosting plus pinning by content hash closes exactly that gap: the manifest entry
  names a hash, the platform serves the bytes matching that hash, and a new build is a new
  hash requiring new approval.

**CSP, defence in depth only.**
- The sandbox origin's CSP restricts `connect-src` (only the platform's relay/signaling
  endpoints and, for games needing external data, the allowlisted proxy route below) and
  `script-src` (`'self'`, no inline, no remote). CSP is a second layer, explicitly **not** a
  substitute for the cross-origin iframe: CSP is opt-in per-response-header and a
  misconfiguration silently fails open, where the browser's iframe/origin isolation does
  not depend on the game getting a header right.

**Approval gate.**
- A human approves a game before it enters the **public catalogue**.
- **Open question:** self-hosted and local-dev instances need to run unapproved/in-progress
  games (that's the entire game-dev loop today - see `hubbub-game-music-guesser`'s
  `CLAUDE.md` dev-loop section). How does a self-hosted operator or a local dev bypass the
  public approval gate without also bypassing it for a public cloud instance pointed at the
  same manifest format? Candidate answers (unresolved, not decided here): a signed
  "dev mode" flag baked into the self-hosted build, or a separate manifest source (local
  filesystem / workspace packages) that only compiles in when `NODE_ENV !== "production"`.

**postMessage bridge contract.**
- Shell -> sandbox (host to game): initial `{ players: PlayerInfo[] }`, then per-tick/event
  `{ type: "action", playerId, action, now }` and `{ type: "playersChanged", players }`.
  `now` is the single clock source (mirrors today's `ActionContext.now`,
  `packages/sdk/src/types.ts:58-60` - games still never call `Date.now()` themselves).
- Sandbox -> shell (game to host): `{ type: "state", state }` on every reducer step, and
  `{ type: "deadline", at: number | null }` mirroring `nextDeadline()`
  (`packages/sdk/src/types.ts:73`) so the **shell's** timer (not the game's) schedules the
  next wake per Blocker #2 below. Optionally `{ type: "result", result: GameResult | null }`
  echoing `result()` so the shell doesn't need to trust the game's own win-declaration
  timing for backup purposes.
- **Everything crossing this boundary is untrusted input.** The shell validates every
  inbound sandbox message against a schema before acting on it (size caps on `state`,
  `at` must be a finite number or null, `result.winnerId` must be a known player id or
  null) exactly as it already validates wire messages via `parseClientMessage` /
  `parseServerMessage` (`packages/protocol/src/messages.ts:95-100`). A malformed or
  oversized message is dropped, not forwarded to other players.

### Connection tiers

Three tiers, negotiated **per connection** (not per room), so a mixed room - some players
on the host's LAN, some remote - is first-class:

| Tier | Path | Notes |
|---|---|---|
| Local host | Electron/LAN host serves everything; controllers connect directly | Existing behaviour (`apps/host-desktop/src/host.ts`), must keep working unchanged |
| Direct | WebRTC DataChannel, phone to screen, signalled through the room DO | Input never touches the cloud |
| Relay | Everything through the cloud DO | Always-available fallback |

- Do **not** detect "same WiFi" via IP heuristics: public-egress-IP comparison
  false-positives on CGNAT (many households share one public IP with strangers) and
  false-negatives on dual-WAN/IPv6 setups.
- Instead, **always attempt the WebRTC upgrade** and classify the achieved tier by reading
  the **selected ICE candidate pair type** after connection: `host`/`host` = same LAN,
  `srflx` = internet P2P (direct), `relay` = fallback. Browsers emit mDNS `.local`
  obfuscated candidates by default; a same-LAN direct connection still succeeds through
  mDNS resolution without ever exposing the private IP to the signaling channel.
- Surface the achieved tier and a measured RTT in the UI (small badge, not a modal).
- Because the screen is now authoritative for every game (see Authority above), this tier
  benefits turn-based games too, not only realtime ones - a turn-based room on Direct or
  Local Host pays no relay hop for its `action` messages either.
- All three tiers stay behind the existing `ClientTransport` interface
  (`packages/protocol/src/transport.ts:10-16`); a WebRTC implementation is a second class
  satisfying the same interface, negotiated by the app, never imported directly by game
  code or the SDK.

### Room codes and abuse

- Codes go from **4 to 6 characters** on the existing 32-char ambiguity-free alphabet
  (`packages/protocol/src/tokens.ts:4`: `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`), giving
  32^6 ~= 1.07 billion combinations (vs 32^4 ~= 1.05 million today). Touches
  `tokens.ts:10-16` (`newRoomCode`'s loop bound) and the two `z.string().length(4)`
  validators (`packages/protocol/src/messages.ts:52`, `:77`).
- Server-side join rate-limiting (per-IP and per-code attempt caps) replaces brute-forcing
  a 6-char code as the realistic attack surface once codes are large.
- No login, no passphrase stays the product decision: a player enters a code and is in.
- Reconnect tokens today are **unsigned random hex in plaintext `localStorage`, no
  expiry** (`newToken()`, `packages/protocol/src/tokens.ts:6-8`, stored client-side as
  `hubbub:token:<code>`). For public cloud deployment this needs hardening: an unsigned
  token that never expires is a permanent room-rejoin credential if a device or its
  `localStorage` leaks. Minimum bar before public launch: expire tokens when a room closes
  (rooms are ephemeral DOs, so this is mostly free) and stop accepting a token for a room
  that no longer exists (already true - `RoomManager.join`, `apps/server/src/rooms.ts:34-36`
  returns `no_room`). Signing tokens is not required at this scale; local-mode rooms live
  only as long as the host process, so the exposure window is already short there.

### Known blockers

| # | Problem | Fix |
|---|---|---|
| 1 | `setup()` is async and may do network I/O (`packages/sdk/src/types.ts:66`); moving it to the browser hits CORS. Verified live: `api.deezer.com` returns no `Access-Control-Allow-Origin`, documented in `hubbub-game-music-guesser/src/deezer.ts:1-4`. | A narrow, **allowlisted** proxy route on the platform Worker (e.g. `/proxy/deezer/*` -> `api.deezer.com/*` only). The allowlist is a fixed map of route prefix to upstream host, checked before every proxied fetch; it is not a general CORS-relay (no arbitrary target host, no header passthrough of `Authorization`/cookies). Reject any request whose target isn't in the map. |
| 2 | Timeout scheduling lives in the Node event loop today as a self-rescheduling `setTimeout` keyed to `Date.now()` (`apps/server/src/server.ts:57-68`, `scheduleTimer`). Under screen authority the server no longer runs game logic, so it can't call `checkTimeout`. | Move scheduling into the **screen's own event loop**, driven by the existing `nextDeadline(state)` hook (`packages/sdk/src/types.ts:73`, already exposed via `GameInstance.nextDeadline()`, `packages/sdk/src/runtime.ts:31-34`). The screen sets its own `setTimeout` to the returned deadline and calls the reducer's `onTimeout` locally; no protocol change needed since this was already a pure function of `state`. |
| 3 | `state: z.unknown()` on the wire (`packages/protocol/src/messages.ts:90`) gives no serializability guarantee. Crossing a postMessage boundary (structured-clone, not JSON) makes a game that stashes a function, a `Map`, or a DOM node in state a live bug, not a latent one. | Require games to declare a **state schema** (`stateSchema: ZodType<State>` alongside today's `actionSchema`, `packages/sdk/src/types.ts:64`). The shell validates every sandbox->shell `state` message against it before broadcasting or backing it up; a game whose state fails its own schema is a caught authoring bug, not a wire failure discovered by a random player's client. |
| 4 | Action ordering: LAN input over WebRTC and remote input over the relay have different jitter, so arrival order at the screen is less deterministic than today's single WS pipe into one server process. | The screen **sequences actions by server-stamped arrival, not client-sent time**: each transport tags an inbound action with the receiving side's `now` at the moment it reaches the screen's message queue (mirrors today's `Date.now()` stamp at `apps/server/src/server.ts:232`, just moved to the screen). The reducer only ever sees `ctx.now` in that arrival order; no lookahead, no reordering buffer. Games that need last-writer-wins semantics (most turn-based games) are unaffected; a game sensitive to sub-tick ordering must debounce in its own reducer. |

### Local and Electron mode parity

Must keep working fully offline: no CDNs, no internet required.

- **Sandbox iframe:** the cross-origin sandbox still applies locally. `apps/host-desktop`'s
  static server (`apps/host-desktop/src/static-server.ts`) serves the sandbox bundle from a
  second local port/origin (mirroring today's split screen:5173/controller:5174 pattern,
  just repurposed) so the isolation property holds even with no internet.
- **Game bundle hosting:** local mode cannot fetch from a cloud-hosted games CDN. The
  eager, offline registry (`packages/games-manifest/src/logics.ts`) and the browser lazy
  registry (`lazy.ts`) both keep resolving to **workspace-local** game packages for local
  builds; only the cloud deployment's manifest resolves `entryUrl` to a remote host. Same
  manifest shape, different `entryUrl` resolution per build target.
- **Proxy route:** the Deezer proxy (Blocker #1) is a Worker route with no local
  equivalent. Locally, `apps/host-desktop`'s own Node server plays the same role
  (Node's `fetch` already has no CORS restriction - see `hubbub-game-music-guesser`'s
  CLAUDE.md "Deezer integration facts"), so local mode needs no proxy at all, just the
  existing direct Node fetch. Games requiring internet (Music Guesser) still fail
  gracefully offline exactly as documented today ("This game needs internet even in local
  LAN mode - surface a clear error state").

## Migration path

Sequenced so remote play becomes usable as early as possible; later phases are distribution
and hardening on top of a working cloud room.

- **Phase A - Merge to one app.** Fold `apps/screen` + `apps/controller` into one app with
  role routing (bare URL = choice, `?room=` = controller, device heuristic preselects).
  Update `apps/host-desktop/src/static-server.ts` to serve one directory. *Done = local LAN
  mode works identically through the merged app; both roles reachable from one origin.*
  Autonomous.
- **Phase B - Screen authority.** Move `onAction`/`onTimeout`/`nextDeadline` execution from
  `apps/server` into the screen; server becomes relay-only for `action` messages; fix
  Blocker #2 (timer moves to the screen). *Done = a turn-based game (Ultimate
  Tic-Tac-Toe) still plays correctly with the server never calling `GameInstance`.*
  Autonomous.
- **Phase C - Cloudflare relay, no sandbox yet.** Stand up a Worker + Durable Object
  implementing today's relay/membership/reconnect protocol (the `ClientMessage`/
  `ServerMessage` shapes stay put) with Hibernation API wiring; deploy the merged app's
  static assets there. Games still ship as workspace-bundled code (no distribution split
  yet), so this phase proves cloud connectivity in isolation. **Needs the owner's
  Cloudflare account** (Workers + Durable Objects enabled, DNS/domain). *Done = two
  browsers on different networks join the same room code and play a full game end to end
  over wss, with an idle room consuming no DO duration.*
- **Phase D - Opaque backup.** Screen pushes `{ gameId, state }` to the room DO after every
  reducer step; DO restores it to a reconnecting/refreshed screen. *Done = refreshing the
  screen mid-game resumes the same state.* Autonomous once Phase C is live.
- **Phase E - Connection tiers.** Add the WebRTC Direct tier behind `ClientTransport`,
  signalled through the room DO; classify tier by ICE candidate pair type; surface tier +
  RTT in the UI. *Done = a same-LAN mixed room (one remote player, rest local) shows Direct
  for the LAN players and Relay for the remote one.* Needs the Cloudflare deployment from
  Phase C for signaling to test against remote players; the WebRTC code itself is
  autonomous.
- **Phase F - Room codes to 6 chars + rate limiting.** Bump `tokens.ts`, both
  `z.string().length(4)` validators, add join rate-limiting. *Done = a 6-char code round
  trips through create/join; a join-flood from one IP gets throttled.* Autonomous.
- **Phase G - Game distribution + sandbox.** Split one game (Music Guesser, since it
  already needs the Deezer proxy) out of the workspace-bundled path into a hash-pinned,
  self-hosted bundle loaded into a cross-origin sandboxed iframe with the postMessage
  bridge; add the CSP layer; add the state-schema requirement (Blocker #3). **Needs the
  owner's Cloudflare account** for the sandbox origin and the games-bundle static host.
  *Done = Music Guesser plays correctly with its reducer and views running inside the
  sandbox, and a manual DOM/localStorage probe from inside the sandbox iframe fails to
  read the shell's token.*
- **Phase H - Deezer proxy route.** Allowlisted `/proxy/deezer/*` Worker route (Blocker
  #1), wired to the sandboxed Music Guesser's `setup()`. **Needs the owner's Cloudflare
  account.** *Done = Music Guesser's song-pool setup succeeds from a browser tab with no
  server-side workaround.*
- **Phase I - Approval catalogue.** Manifest gains `{ version, contentHash }`; a minimal
  human-approval step (even a hand-edited allowlist file) gates which hashes the public
  catalogue serves. Leave the local/self-hosted bypass as the open question above.
  *Done = swapping a game's bundle at its existing URL without a new approved hash is
  rejected by the platform.* Autonomous.
- **Phase J - Reconnect token hardening.** Expire tokens on room close; confirm rejection
  of tokens for closed rooms (partially true already). *Done = a token from a closed room
  is refused.* Autonomous.

## Risks

- **Cloudflare free-tier limits.** DO duration/requests and the 20:1 WebSocket message
  multiplier could bite a busy room faster than expected; needs a real load estimate once
  Phase C is live (Cloudflare account required to measure).
- **postMessage bridge latency.** Adding an iframe hop between input arrival and reducer
  execution costs a few ms per action; likely fine for turn-based/tap games, worth
  measuring for any future `tickRateHz` real-time game once one exists behind the sandbox.
- **ICE candidate classification isn't 100% reliable across all browsers/NATs**; symmetric
  NATs can fail the Direct upgrade entirely, silently falling back to Relay, which is the
  intended behaviour but should be tested against a real symmetric-NAT network before
  launch.
- **Sandbox origin adds an extra DNS/TLS surface** (`games.hubbub.app` alongside
  `app.hubbub.app`) that self-hosted operators must also provision; raises the bar for a
  from-scratch self-host compared to the original spec's single-origin local mode.
- **Best-effort backup could still surprise a player** who expects "nice to have" resilience
  to mean "always recovers" - worth a small UI affordance (e.g. "reconnecting..." vs a
  silent restart to lobby) even though full crash resilience is explicitly out of scope.

## Open questions

- **Approval bypass for self-hosted/local-dev** (flagged in Security above): what
  mechanism lets a self-hosted operator or local game developer run an unapproved game
  without also opening that door on a public cloud instance running the same code.
- **Sandbox origin ownership for self-hosters:** does a self-hosted operator need their own
  second domain/subdomain for the sandbox origin, or can the platform ship a scheme that
  works on a single self-hosted domain (e.g. a path-based pseudo-origin trick) without
  weakening the cross-origin isolation property.
- **State-schema migration for game version bumps:** when a game's `stateSchema` changes
  between versions, what happens to a room whose backup blob was written under the old
  schema (Phase D + Phase G interaction) - not addressed here, needs its own decision once
  both phases exist.
- **Rate-limit thresholds** for join attempts (Phase F) are unspecified numbers; needs a
  concrete value chosen against real Cloudflare Workers rate-limiting primitives.
