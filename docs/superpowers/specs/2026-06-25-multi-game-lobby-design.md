# Hubbub Multi-Game Lobby & Game Picker - Design

> Written 2026-06-25. Adds an AirConsole-style persistent lobby on top of the existing
> framework (Phases 0/1/3 + two games). Read the framework design spec
> (`docs/superpowers/specs/2026-06-24-hubbub-party-game-framework-design.md`) and the
> handoff (`docs/PROJECT_STATE_AND_NEXT_STEPS.md`) first.

## 1. Goal & overview

Replace the dev-only `HUBBUB_GAME`/`VITE_GAME` env switch with a real, on-screen **game
picker lobby**.

Players join a room once and form a persistent **gang**. Each player has a local identity
(name + color + emoji) saved in `localStorage`. From a **screen-rendered landing-page
lobby**, the **host** launches a game; on game-over the host returns to the lobby and
launches another - no restart, same players, same gang.

Two load-bearing properties:

- **The server hosts a registry of all games** and swaps the active game instance at
  runtime, keeping the room and players intact.
- **Every lobby selection is a logical navigation action** (`up/down/left/right` +
  `confirm`), driven by screen-authoritative (server-authoritative, screen-rendered)
  selection state. This is the same "input = logical actions, screen renders everything"
  invariant the games follow, so a keyboard/gamepad controller drops in later with no
  rework. The phone is one renderer of those actions, never the source of truth.

This keeps every framework invariant intact: the framework owns rooms, join/leave, lobby,
state sync, and game switching; a game still implements only its three parts (server logic,
screen view, controller view) and never learns the lobby exists.

## 2. Architecture: framework-owned lobby

The chosen approach (over "lobby-as-a-GameLogic", which would leak orchestration into the
pure game contract). The **room** gains a mode and owns the lobby; games stay pure.

### Room / server model

- `createServer(port, games: GameRegistry)` where `GameRegistry = Record<string,
  GameLogic<any, any>>`. The standalone server's default registry is `{ ttt, uttt }`. This
  replaces the single optional `game` argument; `HUBBUB_GAME` is retired.
- **Room state additions:**
  - `mode: "lobby" | "in-game"` (starts `lobby`).
  - `hostId: string | null`.
  - `currentGameId: string | null`.
  - `cursorIndex: number` - the highlighted tile in the lobby game grid (server-owned).
- **Player additions:** `color: string`, `emoji: string` (name already exists). Join order
  is preserved by the existing insertion-ordered `Map`, which defines "oldest".

### Host model

- The **first joiner becomes host**.
- Only the host may emit `lobbyNav` / `lobbyFocus` / `lobbyConfirm`, `returnToLobby`, and
  `transferHost`. Non-host attempts are ignored (no state change).
- **Host migration:** when the host disconnects, host passes to the **oldest still-connected**
  player; `hostId` becomes `null` if none remain. A reconnecting former host does **not**
  reclaim host automatically.
- **Host handoff:** `transferHost{toPlayerId}` is honored only from the current host and only
  when the target is a connected player.

### Lifecycle

1. `createRoom` → room in `lobby` mode, no `GameInstance`.
2. Players `joinRoom` (carrying identity) → added to roster; first joiner set as host;
   `roomState` broadcast.
3. Host `lobbyNav{dir}` / `lobbyFocus{index}` → server moves/sets `cursorIndex` (clamped to
   the grid) → `roomState` broadcast (screen re-renders the highlight).
4. Host `lobbyConfirm` → if the highlighted game is launchable (connected players ≥ its
   `minPlayers`), server creates `new GameInstance(games[id], connectedPlayers)`, sets
   `mode = "in-game"` and `currentGameId`, and broadcasts `gameState{gameId, state}`.
5. `action{payload}` → routed to the current `GameInstance` (only when `in-game`).
6. Host `returnToLobby` → destroy the `GameInstance`, set `mode = "lobby"`, broadcast
   `roomState`. (The game's own screen view shows the result before this; the host triggers
   the return.)

### Mid-game join (deferred, designed-for)

Joining while `in-game` adds the player to the **roster** (parked); they are **not** added to
the running `GameInstance`, and their controller shows "game in progress". They are included
the next time a game launches. This is forward-compatible with the existing
`GameLogic.onPlayersChanged` hook, which is how mid-game join will later be enabled.

## 3. Protocol changes (`packages/protocol`)

`Player` schema gains `color` and `emoji`.

### Client → Server (additions)

- `joinRoom` gains `color`, `emoji` (identity supplied at join).
- `setIdentity{ name, color, emoji }` - edit identity mid-session (client persists to
  `localStorage`).
- `lobbyNav{ dir: "up" | "down" | "left" | "right" }` - host moves the cursor (relative;
  used by D-pad / keyboard / gamepad).
- `lobbyFocus{ index: number }` - host sets the cursor absolutely (touch tile-tap shortcut).
- `lobbyConfirm` - host launches the highlighted game.
- `returnToLobby` - host ends the current game and returns to the lobby.
- `transferHost{ toPlayerId: string }` - host hands off host.
- `action{ payload }` - unchanged (in-game).

All host-only messages are validated server-side against `hostId`; the framework ignores
them from non-hosts.

### Server → Client (changes)

- `roomState` is the **room/lobby context channel**, always kept current. It carries:
  - `players: [{ id, name, color, emoji, connected, isHost }]`
  - `hostId: string | null`
  - `mode: "lobby" | "in-game"`
  - `currentGameId: string | null`
  - `cursorIndex: number`
  - `games: [{ id, name, minPlayers, maxPlayers, featured }]`

  Broadcast on join/leave, identity change, host change, mode change, and cursor change.
- `gameState` gains `gameId` (so apps pick the right view). Broadcast on game updates.
- `roomCreated`, `joined`, `error` unchanged.

**Two-channel rule:** `roomState` is the room/lobby context; `gameState` is the active game.
Apps subscribe to both. `roomState.mode` selects which view renders; host controls (e.g.
"Back to lobby") read `roomState` even while in-game.

## 4. SDK (`packages/sdk`)

- `GameLogic` is **unchanged** - games stay pure.
- Add a `GameRegistry` type and a small helper to derive lobby game-list meta
  (`{ id, name, minPlayers, maxPlayers, featured }`) from the registry.
- Identity and lobby wire types live in `protocol` (it owns wire schemas), not the SDK.

## 5. Screen app (landing-page lobby)

- `App` routes on `roomState.mode`: `lobby` → `<Lobby>`, `in-game` →
  `<GameScreen gameId={...} state={...}>`.
- **Lobby view:**
  - A **featured-games carousel banner** across the top.
  - A navigable **2D game grid** with a highlight cursor at `roomState.cursorIndex`. Games
    needing more players than are connected render disabled.
  - Room **code** + **QR**.
  - **Player roster** showing each player's color + emoji + name, with a host badge.
- `game.tsx` is generalized from a build-time `VITE_GAME` switch to a **dynamic registry
  keyed by the server's `gameId`**. All games are bundled (the offline-LAN rule requires it).
- The game's own screen view continues to render its result on game-over.

## 6. Controller app

- **Identity / Settings:** on load, read `localStorage` key `hubbub:identity`
  `{ name, color, emoji }`. If absent, show a **Settings screen first** (name field, a fixed
  color-swatch palette, and a curated grid of **offline-safe system emoji** - no CDN) →
  save → join. A gear button edits identity anytime (`setIdentity` + persist).
- Routes on `roomState.mode` + whether this player is host:
  - **lobby + host:** a D-pad (`↑ ↓ ← →`) + **Confirm** button emitting
    `lobbyNav`/`lobbyConfirm`; tappable game tiles as a shortcut (`lobbyFocus` then
    `lobbyConfirm`); a **transfer-host** control; settings.
  - **lobby + non-host:** "waiting for host" + roster + settings.
  - **in-game:** the game's `GameController` for `gameId` (dynamic registry); the host also
    sees a **"Back to lobby"** control (`returnToLobby`).
- Reconnect token stays under `hubbub:token:{code}`; identity is a separate `localStorage`
  key, so it persists across rooms.

## 7. Deferred TODOs (flagged, not built now)

- **Game suggestions:** a non-host taps a game to "suggest" it; suggestions surface as
  options on the screen and as a shortcut on the host's selector. Built on a logical
  "suggest game X" action, so it does not become the only selection path.
- **Mid-game join:** add late joiners into the running game via `onPlayersChanged`.
- **Featured curation:** `featured` is `true` for all games for now.
- **Host abort-mid-game** UX polish (return to lobby while a game is still in progress).

## 8. Testing

Mirror the existing `apps/server/src/server.*.test.ts` style (real `ws` round-trips) plus
`rooms.ts` unit tests. Cover:

- First joiner becomes host (`isHost` true in `roomState`); second joiner is not.
- A non-host `lobbyConfirm` / lobby control is ignored (no game starts); the host's launches.
- `lobbyNav` moves `cursorIndex`; `lobbyFocus` sets it; `lobbyConfirm` launches the
  highlighted game and emits `gameState{ gameId }`.
- A game whose `minPlayers` exceeds the connected count cannot launch.
- `action` is routed only while `in-game`.
- `returnToLobby` (host) returns to `lobby` mode and clears the instance.
- Host disconnect migrates host to the oldest connected player; `transferHost` works from the
  host and is ignored from a non-host.
- Identity (`name`/`color`/`emoji`) round-trips in `roomState`.
- A **full session**: launch `ttt` → `returnToLobby` → launch `uttt`, with the same players
  retained throughout.

Lobby and Settings views are presentational and have no unit tests, consistent with the
existing game-view pattern. Verification floor before done: `pnpm typecheck`, `pnpm test`,
and `pnpm build` all green.

## 9. Out of scope

Cloud/wss deploy, real-time (`tickRateHz`) games, WebRTC transport, and the physical
keyboard/gamepad controller itself (this design only makes the lobby *ready* for it). These
remain later phases per the framework spec.
