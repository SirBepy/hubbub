# Hubbub - Party Game Framework Design

> Status: Approved design (2026-06-24). Next step: implementation plan via writing-plans.

An open-source, self-hostable party-game platform. A big screen (TV/laptop browser) runs
the game; phones are the controllers (join via room code or QR). Real-time. Works in a
zero-cost **local LAN mode** and a hosted **cloud mode**. A framework that many games are
built on top of. Think Jackbox, but self-hostable and extensible.

---

## 1. Research summary (why build from scratch)

Evaluated existing repos as possible foundations. Bottom line: **build from scratch, borrow patterns.**
No maintained + permissively-licensed + on-model project exists.

| Repo | State | Verdict |
|---|---|---|
| greggman/HappyFunTimes | Dead, deprecated by author (~2016, BSD-3) | Right concept, but died from the exact modern-browser constraints we must design around (HTTPS-for-sensors, local-serving friction). Cautionary reference only. |
| shone/phoneparty | Abandoned (2023), **no license** | WebRTC pattern is instructive; legally not forkable. |
| tannerkrewson/rocketcrab | Active, MIT, 265 stars | A lobby/launcher (iframes existing games), not a controller transport. Cloud-first. Wrong layer. |
| vucinatim/air-jam | New (Nov 2025), MIT, tiny adoption | Closest modern match (TS + WS + Zod-per-input). Study as architectural template; too unproven to fork wholesale. |
| AirConsole/airconsole-api | Proprietary platform | Mirror its API surface for developer familiarity. |

Patterns to borrow: air-jam's SDK/server-package split + Zod-schema-per-input; the AirConsole
API surface for ergonomics; rocketcrab's lobby idea if a multi-game launcher is wanted later.

## 2. Recommendation

Build a fresh, **WebSocket-first, host/screen-authoritative** framework in TypeScript.
Default transport WebSocket (NAT-friendly, identical in LAN and cloud); reserve WebRTC for
high-frequency real-time input behind a transport interface.

## 3. Tech stack

- **TypeScript everywhere** - shared types across screen, controller, and server is the biggest win.
- **Server:** Node 20+, native `ws` (not Socket.io - we need our own clean transport interface to swap in WebRTC).
- **Validation:** Zod, shared schemas, one source of truth for every message shape.
- **Web UI:** React + Vite. Games render however they want (DOM/React for turn-based, PixiJS for 2D, Three.js for simple 3D).
- **Icons:** Phosphor (`@phosphor-icons/react`).
- **Monorepo:** pnpm workspaces + Turborepo (concurrency capped at 5).
- **Desktop host:** Electron (embeds the Node server in a double-click app).
- **Mobile controller:** Web/PWA only (zero-install is the whole point). Native reachable later via Capacitor wrap of the same code, no rewrite.
- **Cloud:** same screen + controller apps served from a hosted server (wss).

## 4. Monorepo layout

```
/apps
  screen          big-screen app: lobby + game host renderer
  controller      phone PWA
  server          Node WS room server (standalone CLI or embedded in Electron)
  host-desktop    Electron wrapper (bundles server + screen)
/packages
  protocol        message envelope, Zod schemas, Transport interface, reconnect tokens
  sdk             the GameDefinition contract + framework runtime
  ui              shared components + Phosphor icons
  games/*         ultimate-ttt, music-guesser, ...
```

Design for isolation: each package has one clear purpose and a defined interface. `protocol`
knows nothing about games; `sdk` depends on `protocol`; each game depends only on `sdk`.

## 5. Architecture

### Rooms / sessions
- Host starts a session -> server mints a **Room** with a 4-letter **code** (Jackbox-style) + a secret id.
- Screen joins as the room's screen client; phones join as players with the code.
- Server owns membership. Game-state **authority is per-game**: screen-authoritative for real-time games, server-authoritative for turn-based.
- Every player gets a **reconnect token** so a WiFi blip reclaims their slot (a HappyFunTimes failure mode, designed for up front).

### Phone discovery / join
- Screen shows the code + a **QR** of the join URL.
- **Cloud:** QR -> `https://app/?room=ABCD`.
- **Local:** host app detects its LAN IP -> QR -> `http://<lan-ip>:<port>/?room=ABCD`. Same-WiFi phone connects straight to the host.
- **Known landmine (killed HappyFunTimes):** browsers gate motion sensors behind HTTPS. Touch/button controllers work on plain-HTTP LAN; a game declaring `needs.motion` triggers a local-cert / secure-context path. Designed in, not retrofitted.

### Local vs cloud switch
- One config flag = the server endpoint + QR target. **Game code is identical** in both modes; only transport endpoint and discovery differ.

### Real-time support
- The phone is a **dumb controller**; the **screen renders everything**. A player's input pays only **one-way latency** (phone -> screen), never a round trip. On LAN ~5-30ms, which feels instant.
- A game opts into a **screen-authoritative 60fps loop** by declaring `tickRateHz`. Turn-based games omit it and stay simple.
- **Transport is swappable:** WebSocket default; **WebRTC DataChannel** drops in behind the same interface for steering-heavy continuous input (e.g. a racer's tilt), with no game-code change. Signaling rides the room server.
- Simple 3D (a basic racer) is fine in WebGL/Three.js inside Electron/browser; only AAA 3D would need native, which is out of scope.

### Game plugin contract (the core API a developer implements)

```ts
interface GameDefinition<State, Input> {
  id: string
  meta: { name; minPlayers; maxPlayers; needs?: { motion?: boolean; audio?: boolean } }
  inputSchema: ZodSchema<Input>              // shared validation
  server: {
    init(ctx): State
    onInput(state, playerId, input): State   // turn-based path
    tickRateHz?: number                       // set => real-time loop (screen-authoritative)
  }
  screen: ScreenComponent<State>             // renders the shared display / runs sim
  controller: ControllerComponent<State, Input>  // phone UI, emits validated Input
}
```

The framework handles rooms, join/leave, state sync, input routing, reconnection, lobby, QR,
and the local/cloud transport. A game implements only **three parts**: server logic, screen
view, controller view. `tickRateHz` is the single switch between turn-based and real-time, so
the roadmap's simple and twitchy games coexist without bloating either.

### Input abstraction (logical actions)

Games bind to **logical actions** (`jump`, `left`, `select`), never raw keys or specific touch
widgets. The framework maps **physical inputs onto actions**:
- touch widgets (`Button`, `DPad`, `TiltPad`, `TextInput`, `ColorPicker`) on phones,
- **keyboard** keys and **gamepad** buttons/axes on the screen machine.

This makes "also works on keyboard/gamepad" mostly free, and makes automated input tests
straightforward (assert each input source produces the right logical action). The action-based
shape is designed in from Phase 1 even though keyboard/gamepad support ships later (see roadmap).

### Layouts per game
- **Controller UI:** composed from SDK input widgets that auto-wire to the input schema / logical actions.
- **Screen UI:** full creative freedom; framework hands it the mount, state, and player list.

### State sync
- Authority broadcasts state (event-driven for turn-based; compact snapshots at `tickRateHz` for real-time) to the screen and relevant controllers.

## 6. Build order

Each phase ends in something demonstrable. Real-time and cloud are deferred until a simple
game proves the framework, but their hooks (transport interface, `tickRateHz`, action-based
input) are built in early so neither needs a rewrite.

- **Phase 0 - Skeleton & protocol:** monorepo; `protocol` package (Transport interface, envelope, Zod, reconnect tokens); `ws` transport; bare room (create / code / join / player-list / broadcast). *Done = phone joins, name shows on screen.*
- **Phase 1 - SDK & lifecycle:** `GameDefinition` runtime; server-authoritative path; input routing + validation; event-driven state sync; lobby/QR; local/cloud config; action-based input layer + basic widgets.
- **Phase 2 - First game (Ultimate Tic-Tac-Toe):** validates join, turns, validation, sync, reconnect. *Done = two phones play a full game and survive a WiFi blip.*
- **Phase 3 - Local product (Electron host):** embed server, LAN-IP QR, installers. *Done = send a friend the app, play TTT on real WiFi.* First sendable product.
- **Phase 4 - Real-time path:** `tickRateHz` + screen-authoritative loop; `TiltPad`/motion + LAN secure-context; WebRTC DataChannel transport behind the interface. *Done = a Flappy / jump-on-heads prototype feels responsive.*
- **Phase 5 - Cloud mode:** deploy server + screen (wss); public room URLs. Same games run unchanged. *Done = remote play works.* **Superseded:** the cloud plan is now `2026-08-05-hubbub-cloud-hosting-and-game-distribution-design.md` (Cloudflare Workers + Durable Objects, one origin, sandboxed game distribution) - see that spec's Migration path instead of this line.
- **Phase 6+ - Content & opening up:** Music Guesser (Deezer) -> verify-then-build Spotify Stats -> port Split Opinions -> keyboard/gamepad input + tests -> public SDK + sandboxing.

## 7. Planned games (roadmap context)

1. **Ultimate Tic-Tac-Toe** - framework validation (turn-based).
2. **Music Guesser** - hear a clip, guess title/artist. **Audio source: Deezer.** See decision below.
3. **Spotify Stats** - players OAuth Spotify; ask "who listened to this artist most?" etc. **Policy risk, must verify** (see below).
4. **Split Opinions** - existing AirConsole opinion game, ported last.

## 8. Decisions log

- **Build from scratch** (no maintained/forkable base).
- **WebSocket default**, WebRTC behind a swappable transport interface.
- **Screen-authoritative** for real-time, **server-authoritative** for turn-based, switched by `tickRateHz`. **Superseded:** `2026-08-05-hubbub-cloud-hosting-and-game-distribution-design.md` moves ALL games to screen authority; the server becomes relay + membership + reconnect + signaling only.
- **Electron** host app for local mode; CLI run is the dev/testing path.
- **Web/PWA** mobile controllers only; native deferred (Capacitor, no rewrite).
- **Action-based input** abstraction from Phase 1.
- **Music audio source = Deezer** (no auth, free 30s MP3 via hidden `<audio>`, minimal terms). **Spotify rejected** for Music Guesser: Developer Policy bans games + `preview_url` is null for new apps. YouTube IFrame is a viable optional mode but forces a *visible* player (no audio-only), so it is secondary.
- **License = MIT** (max adoption, lowest friction; fork protection deemed unnecessary). Copyright-holder line in `LICENSE` is a placeholder (`Joe`) to swap for the preferred legal/display name before public release.
- **Product name = working codename `hubbub`;** real public name decided before launch.
- **No fixed player cap;** each game declares `meta.maxPlayers`, the framework provides a sane default.
- **Offline LAN = no CDNs.** Bundle all assets (Phosphor icons, fonts, everything) into the apps; never CDN-load, local mode has no internet. (Overrides the usual CDN habit.)
- **Screen wake-lock:** the screen app holds a Wake Lock so the display never sleeps mid-game.
- **Cloud room-code security:** private rooms + rate-limiting / non-trivially-enumerable join so strangers can't join via guessed codes. Local LAN exempt.

## 9. Future work / open risks (captured, not yet prioritized)

- **Multi-input controllers:** keyboard + gamepad as first-class controllers (not only phones), via the action abstraction above. Games that support joysticks/keyboard should ship **automated input tests** verifying each source maps to the correct logical action.
- **Sandboxing untrusted public games:** when third parties ship games, their code is untrusted. Screen/controller views run in **sandboxed iframes**; server-side game logic runs **capability-limited** (no raw filesystem/network, only the SDK API); **review/signing** before listing. Built only when the platform opens to the public.
- **Public third-party SDK:** versioned, documented SDK with sandbox/isolation. Backlog item; clean public-ready boundaries are designed in now, the public tooling itself comes later.
- **Spotify Stats policy risk:** Spotify's "do not create a game" Developer Policy may also threaten game #3 even though it only reads listening data. **Verify before building.** Does not block the framework.
- **LAN HTTPS for motion sensors:** the secure-context strategy for `needs.motion` games (local cert vs cloud-assisted upgrade) needs a concrete chosen approach before Phase 4.
