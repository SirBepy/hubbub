# Multi-Game Lobby & Game Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `HUBBUB_GAME`/`VITE_GAME` env switch with an AirConsole-style lobby: players join a persistent gang with a saved identity (name + color + emoji), and a host launches/switches games from a screen-rendered, controller-navigable picker, with the server swapping the active game at runtime.

**Architecture:** Framework-owned lobby (games stay pure). The room gains a `mode` (`lobby` | `in-game`), a `hostId`, a `currentGameId`, and a `cursorIndex`. The server holds a `GameRegistry` and creates/destroys a `GameInstance` on host launch / return-to-lobby. `roomState` becomes the always-current room/lobby context channel; `gameState` carries the active game (now with `gameId`). All lobby selection is logical actions (`lobbyNav`/`lobbyFocus`/`lobbyConfirm`) so keyboard/gamepad drop in later.

**Tech Stack:** TypeScript, Zod (wire schemas), `ws`, React/Vite, Vitest. Same toolchain as the rest of the monorepo.

Full design: `docs/superpowers/specs/2026-06-25-multi-game-lobby-design.md`.

## Global Constraints

- **Windows shell:** prefer PowerShell; **one command per call**; never chain with `&&`/`;`/`|`.
- **No em-dash characters** anywhere (use comma/colon/hyphen).
- **Commits:** ALWAYS via the `/commit` skill, never `git commit` directly. Subagents stage only and NEVER commit; the orchestrator runs `/commit` after each task.
- **Monorepo:** pnpm workspaces + Turborepo, **concurrency capped at 5**. Source uses `.js` import extensions in TS (ESM). Mirror existing file patterns.
- **Offline LAN = no CDNs.** Bundle everything; emoji/colors are system unicode + hex strings, never fetched. Apps bundle ALL games.
- **Games stay pure:** never import a concrete transport or the lobby into game code. `GameLogic` is unchanged by this plan.
- **Verification floor before "done":** `pnpm typecheck`, `pnpm test`, `pnpm build` all green (run from repo root `C:\Users\tecno\Desktop\Projects\hubbub`).
- **Identity caps:** name 1-24 chars, color any string (hex from a fixed palette), emoji 1-16 chars.
- **Cursor navigation is linear** over the games list: `left`/`up` => index-1, `right`/`down` => index+1, clamped to `[0, count-1]`. (Geometry-aware 2D nav is a later polish.)

---

### Task 1: Protocol - identity, lobby messages, channel reshape

**Files:**
- Modify: `packages/protocol/src/messages.ts`
- Test: `packages/protocol/src/messages.test.ts`

**Interfaces:**
- Produces: extended `PlayerSchema`/`Player` (`+color, +emoji`); new `GameSummarySchema`/`GameSummary`; new client messages `setIdentity`, `lobbyNav`, `lobbyFocus`, `lobbyConfirm`, `returnToLobby`, `transferHost`; `joinRoom` gains `color`+`emoji`; reshaped `roomState` (`+hostId, +mode, +currentGameId, +cursorIndex, +games`, players carry identity); `gameState` gains `gameId`.
- Consumed by: every other task.

- [ ] **Step 1: Update existing tests to the new shapes and add new-message tests**

Replace `packages/protocol/src/messages.test.ts` with:
```ts
import { describe, it, expect } from "vitest";
import { parseClientMessage, parseServerMessage } from "./messages.js";

describe("protocol messages", () => {
  it("parses a valid joinRoom with identity", () => {
    const raw = { t: "joinRoom", code: "ABCD", name: "Joe", color: "#4363d8", emoji: "🦊" };
    expect(parseClientMessage(JSON.stringify(raw))).toEqual(raw);
  });

  it("rejects an unknown message type", () => {
    expect(() => parseClientMessage(JSON.stringify({ t: "nope" }))).toThrow();
  });

  it("rejects joinRoom missing identity fields", () => {
    expect(() =>
      parseClientMessage(JSON.stringify({ t: "joinRoom", code: "ABCD", name: "Joe" }))
    ).toThrow();
  });

  it("parses lobby control messages", () => {
    expect(parseClientMessage(JSON.stringify({ t: "lobbyNav", dir: "left" }))).toEqual({ t: "lobbyNav", dir: "left" });
    expect(parseClientMessage(JSON.stringify({ t: "lobbyFocus", index: 2 }))).toEqual({ t: "lobbyFocus", index: 2 });
    expect(parseClientMessage(JSON.stringify({ t: "lobbyConfirm" }))).toEqual({ t: "lobbyConfirm" });
    expect(parseClientMessage(JSON.stringify({ t: "returnToLobby" }))).toEqual({ t: "returnToLobby" });
    expect(parseClientMessage(JSON.stringify({ t: "transferHost", toPlayerId: "p2" }))).toEqual({ t: "transferHost", toPlayerId: "p2" });
    expect(parseClientMessage(JSON.stringify({ t: "setIdentity", name: "Jo", color: "#000", emoji: "🐼" }))).toEqual({ t: "setIdentity", name: "Jo", color: "#000", emoji: "🐼" });
  });

  it("rejects lobbyNav with a bad direction", () => {
    expect(() => parseClientMessage(JSON.stringify({ t: "lobbyNav", dir: "sideways" }))).toThrow();
  });

  it("parses a gameState server message with gameId", () => {
    const raw = { t: "gameState", gameId: "ttt", state: { foo: 1 } };
    expect(parseServerMessage(JSON.stringify(raw))).toEqual(raw);
  });

  it("parses a roomState server message with lobby context", () => {
    const raw = {
      t: "roomState",
      players: [{ id: "p1", name: "Joe", color: "#f58231", emoji: "🐱", connected: true }],
      hostId: "p1",
      mode: "lobby",
      currentGameId: null,
      cursorIndex: 0,
      games: [{ id: "ttt", name: "Tic-Tac-Toe", minPlayers: 2, maxPlayers: 2, featured: true }],
    };
    expect(parseServerMessage(JSON.stringify(raw))).toEqual(raw);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run packages/protocol/src/messages.test.ts`
Expected: FAIL (new fields/messages not in schema yet).

- [ ] **Step 3: Implement the schema changes**

Replace `packages/protocol/src/messages.ts` with:
```ts
import { z } from "zod";

export const PlayerSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(24),
  color: z.string(),
  emoji: z.string().min(1).max(16),
  connected: z.boolean(),
});
export type Player = z.infer<typeof PlayerSchema>;

export const GameSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  minPlayers: z.number().int(),
  maxPlayers: z.number().int().optional(),
  featured: z.boolean(),
});
export type GameSummary = z.infer<typeof GameSummarySchema>;

const identity = {
  name: z.string().min(1).max(24),
  color: z.string(),
  emoji: z.string().min(1).max(16),
};

// Client -> Server
export const ClientMessageSchema = z.discriminatedUnion("t", [
  z.object({ t: z.literal("createRoom") }),
  z.object({ t: z.literal("joinRoom"), code: z.string().length(4), ...identity, token: z.string().optional() }),
  z.object({ t: z.literal("setIdentity"), ...identity }),
  z.object({ t: z.literal("lobbyNav"), dir: z.enum(["up", "down", "left", "right"]) }),
  z.object({ t: z.literal("lobbyFocus"), index: z.number().int().min(0) }),
  z.object({ t: z.literal("lobbyConfirm") }),
  z.object({ t: z.literal("returnToLobby") }),
  z.object({ t: z.literal("transferHost"), toPlayerId: z.string() }),
  z.object({ t: z.literal("action"), payload: z.unknown().optional() }),
]);
export type ClientMessage = z.infer<typeof ClientMessageSchema>;

// Server -> Client
export const ServerMessageSchema = z.discriminatedUnion("t", [
  z.object({ t: z.literal("roomCreated"), code: z.string().length(4) }),
  z.object({ t: z.literal("joined"), playerId: z.string(), token: z.string() }),
  z.object({
    t: z.literal("roomState"),
    players: z.array(PlayerSchema),
    hostId: z.string().nullable(),
    mode: z.enum(["lobby", "in-game"]),
    currentGameId: z.string().nullable(),
    cursorIndex: z.number().int(),
    games: z.array(GameSummarySchema),
  }),
  z.object({ t: z.literal("gameState"), gameId: z.string(), state: z.unknown() }),
  z.object({ t: z.literal("error"), code: z.string(), message: z.string() }),
]);
export type ServerMessage = z.infer<typeof ServerMessageSchema>;

export function parseClientMessage(raw: string): ClientMessage {
  return ClientMessageSchema.parse(JSON.parse(raw));
}
export function parseServerMessage(raw: string): ServerMessage {
  return ServerMessageSchema.parse(JSON.parse(raw));
}
```

> Note: `isHost` is derived client-side as `player.id === roomState.hostId`; it is intentionally NOT a per-player field (DRY).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run packages/protocol/src/messages.test.ts`
Expected: PASS. Then `pnpm --filter @hubbub/protocol typecheck` - no errors.

- [ ] **Step 5: Stage changes (do NOT commit)** - stage the two protocol files.

---

### Task 2: SDK - GameRegistry type + lobby summary helper

**Files:**
- Create: `packages/sdk/src/registry.ts`
- Modify: `packages/sdk/src/index.ts`
- Test: `packages/sdk/src/registry.test.ts`

**Interfaces:**
- Consumes: `GameLogic` from `./types.js`.
- Produces: `type GameRegistry = Record<string, GameLogic<any, any>>`; `interface GameSummary { id; name; minPlayers; maxPlayers?; featured }`; `function gameSummaries(registry: GameRegistry, featured?: Set<string>): GameSummary[]` (when `featured` omitted, every game is `featured: true`). Structurally matches protocol's `GameSummarySchema`.

- [ ] **Step 1: Write the failing test**

`packages/sdk/src/registry.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { z } from "zod";
import { gameSummaries, type GameRegistry } from "./registry.js";
import type { GameLogic } from "./types.js";

const fake = (name: string, minPlayers: number, maxPlayers?: number): GameLogic<any, any> => ({
  meta: { name, minPlayers, maxPlayers },
  actionSchema: z.any(),
  init: () => ({}),
  onAction: (s) => s,
  onPlayersChanged: (s) => s,
});

describe("gameSummaries", () => {
  it("derives summaries from a registry, featured by default", () => {
    const reg: GameRegistry = { a: fake("Alpha", 2, 2), b: fake("Beta", 1) };
    expect(gameSummaries(reg)).toEqual([
      { id: "a", name: "Alpha", minPlayers: 2, maxPlayers: 2, featured: true },
      { id: "b", name: "Beta", minPlayers: 1, maxPlayers: undefined, featured: true },
    ]);
  });

  it("honors an explicit featured set", () => {
    const reg: GameRegistry = { a: fake("Alpha", 2), b: fake("Beta", 1) };
    expect(gameSummaries(reg, new Set(["b"])).map((g) => [g.id, g.featured])).toEqual([
      ["a", false],
      ["b", true],
    ]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run packages/sdk/src/registry.test.ts`
Expected: FAIL - cannot resolve `./registry.js`.

- [ ] **Step 3: Implement the registry**

`packages/sdk/src/registry.ts`:
```ts
import type { GameLogic } from "./types.js";

export type GameRegistry = Record<string, GameLogic<any, any>>;

export interface GameSummary {
  id: string;
  name: string;
  minPlayers: number;
  maxPlayers?: number;
  featured: boolean;
}

export function gameSummaries(registry: GameRegistry, featured?: Set<string>): GameSummary[] {
  return Object.entries(registry).map(([id, game]) => ({
    id,
    name: game.meta.name,
    minPlayers: game.meta.minPlayers,
    maxPlayers: game.meta.maxPlayers,
    featured: featured ? featured.has(id) : true,
  }));
}
```

- [ ] **Step 4: Export from the barrel** - in `packages/sdk/src/index.ts`, add (keep existing exports):
```ts
export * from "./registry.js";
```

- [ ] **Step 5: Run it to verify it passes**

Run: `pnpm vitest run packages/sdk/src/registry.test.ts`
Expected: PASS. Then `pnpm --filter @hubbub/sdk typecheck` - no errors.

- [ ] **Step 6: Stage changes (do NOT commit)** - stage the three sdk files.

---

### Task 3: RoomManager - identity, host, mode, cursor, migration, transfer

**Files:**
- Modify: `apps/server/src/rooms.ts`
- Test: `apps/server/src/rooms.test.ts`

**Interfaces:**
- Consumes: `Player` from `@hubbub/protocol`, `newRoomCode`/`newToken` from `@hubbub/protocol/tokens`.
- Produces: `RoomManager` with `createRoom(): string`, `hasRoom(code)`, `join(code, identity: Identity, token?): JoinOk|JoinErr`, `setIdentity(code, playerId, identity)`, `setConnected(code, playerId, connected)`, `hostId(code): string|null`, `isHost(code, playerId): boolean`, `transferHost(code, fromId, toId): boolean`, `mode(code): RoomMode`, `currentGameId(code): string|null`, `cursorIndex(code): number`, `setMode(code, mode, gameId)`, `moveCursor(code, dir, count)`, `focusCursor(code, index, count)`, `players(code): Player[]`, `connectedPlayers(code): Player[]`. Types `Identity { name; color; emoji }`, `RoomMode = "lobby"|"in-game"`.

- [ ] **Step 1: Replace the test file with identity-aware + lobby tests**

Replace `apps/server/src/rooms.test.ts` with:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { RoomManager, type Identity } from "./rooms.js";

let rm: RoomManager;
beforeEach(() => (rm = new RoomManager()));

const ann: Identity = { name: "Ann", color: "#e6194B", emoji: "🦊" };
const bo: Identity = { name: "Bo", color: "#3cb44b", emoji: "🐼" };

describe("RoomManager", () => {
  it("creates a retrievable room in lobby mode", () => {
    const code = rm.createRoom();
    expect(code).toHaveLength(4);
    expect(rm.hasRoom(code)).toBe(true);
    expect(rm.mode(code)).toBe("lobby");
    expect(rm.hostId(code)).toBeNull();
  });

  it("adds a player with identity and makes the first joiner host", () => {
    const code = rm.createRoom();
    const r = rm.join(code, ann);
    expect(r.ok).toBe(true);
    expect(rm.players(code)).toEqual([
      { id: (r as any).playerId, name: "Ann", color: "#e6194B", emoji: "🦊", connected: true },
    ]);
    expect(rm.hostId(code)).toBe((r as any).playerId);
    expect(rm.isHost(code, (r as any).playerId)).toBe(true);
  });

  it("does not make the second joiner host", () => {
    const code = rm.createRoom();
    const a = rm.join(code, ann) as any;
    const b = rm.join(code, bo) as any;
    expect(rm.hostId(code)).toBe(a.playerId);
    expect(rm.isHost(code, b.playerId)).toBe(false);
  });

  it("reclaims the same player id when rejoining with a token", () => {
    const code = rm.createRoom();
    const first = rm.join(code, ann) as any;
    rm.setConnected(code, first.playerId, false);
    const again = rm.join(code, ann, first.token) as any;
    expect(again.playerId).toEqual(first.playerId);
    expect(rm.players(code)).toHaveLength(1);
    expect(rm.players(code)[0].connected).toBe(true);
  });

  it("migrates host to the oldest connected player when the host disconnects", () => {
    const code = rm.createRoom();
    const a = rm.join(code, ann) as any;
    const b = rm.join(code, bo) as any;
    rm.setConnected(code, a.playerId, false);
    expect(rm.hostId(code)).toBe(b.playerId);
  });

  it("does not let a reconnecting former host reclaim host", () => {
    const code = rm.createRoom();
    const a = rm.join(code, ann) as any;
    const b = rm.join(code, bo) as any;
    rm.setConnected(code, a.playerId, false);
    rm.setConnected(code, a.playerId, true);
    expect(rm.hostId(code)).toBe(b.playerId);
  });

  it("clears host when everyone disconnects, reassigns on reconnect", () => {
    const code = rm.createRoom();
    const a = rm.join(code, ann) as any;
    rm.setConnected(code, a.playerId, false);
    expect(rm.hostId(code)).toBeNull();
    rm.setConnected(code, a.playerId, true);
    expect(rm.hostId(code)).toBe(a.playerId);
  });

  it("transfers host only from the host to a connected target", () => {
    const code = rm.createRoom();
    const a = rm.join(code, ann) as any;
    const b = rm.join(code, bo) as any;
    expect(rm.transferHost(code, b.playerId, a.playerId)).toBe(false); // non-host cannot
    expect(rm.transferHost(code, a.playerId, b.playerId)).toBe(true);
    expect(rm.hostId(code)).toBe(b.playerId);
  });

  it("updates identity in place", () => {
    const code = rm.createRoom();
    const a = rm.join(code, ann) as any;
    rm.setIdentity(code, a.playerId, { name: "Annie", color: "#000", emoji: "🐱" });
    expect(rm.players(code)[0]).toMatchObject({ name: "Annie", color: "#000", emoji: "🐱" });
  });

  it("moves and clamps the lobby cursor and sets it absolutely", () => {
    const code = rm.createRoom();
    rm.join(code, ann);
    rm.moveCursor(code, "left", 3); // clamp at 0
    expect(rm.cursorIndex(code)).toBe(0);
    rm.moveCursor(code, "right", 3);
    expect(rm.cursorIndex(code)).toBe(1);
    rm.moveCursor(code, "down", 3);
    expect(rm.cursorIndex(code)).toBe(2);
    rm.moveCursor(code, "right", 3); // clamp at count-1
    expect(rm.cursorIndex(code)).toBe(2);
    rm.focusCursor(code, 0, 3);
    expect(rm.cursorIndex(code)).toBe(0);
  });

  it("sets mode and current game", () => {
    const code = rm.createRoom();
    rm.setMode(code, "in-game", "ttt");
    expect(rm.mode(code)).toBe("in-game");
    expect(rm.currentGameId(code)).toBe("ttt");
  });

  it("lists only connected players via connectedPlayers", () => {
    const code = rm.createRoom();
    const a = rm.join(code, ann) as any;
    rm.join(code, bo);
    rm.setConnected(code, a.playerId, false);
    expect(rm.connectedPlayers(code).map((p) => p.name)).toEqual(["Bo"]);
  });

  it("errors when joining a missing room", () => {
    expect(rm.join("ZZZZ", ann)).toEqual({ ok: false, code: "no_room", message: expect.any(String) });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run apps/server/src/rooms.test.ts`
Expected: FAIL (new signatures/methods missing).

- [ ] **Step 3: Implement the new RoomManager**

Replace `apps/server/src/rooms.ts` with:
```ts
import { type Player } from "@hubbub/protocol";
import { newRoomCode, newToken } from "@hubbub/protocol/tokens";

export type RoomMode = "lobby" | "in-game";
export interface Identity { name: string; color: string; emoji: string; }

interface StoredPlayer extends Player { token: string; }
interface Room {
  code: string;
  players: Map<string, StoredPlayer>;
  hostId: string | null;
  mode: RoomMode;
  currentGameId: string | null;
  cursorIndex: number;
}

export interface JoinOk { ok: true; playerId: string; token: string; }
export interface JoinErr { ok: false; code: "no_room"; message: string; }

export class RoomManager {
  private rooms = new Map<string, Room>();

  createRoom(): string {
    let code = newRoomCode();
    while (this.rooms.has(code)) code = newRoomCode();
    this.rooms.set(code, { code, players: new Map(), hostId: null, mode: "lobby", currentGameId: null, cursorIndex: 0 });
    return code;
  }

  hasRoom(code: string): boolean { return this.rooms.has(code); }

  join(code: string, identity: Identity, token?: string): JoinOk | JoinErr {
    const room = this.rooms.get(code);
    if (!room) return { ok: false, code: "no_room", message: "Room not found" };

    if (token) {
      for (const p of room.players.values()) {
        if (p.token === token) {
          p.name = identity.name; p.color = identity.color; p.emoji = identity.emoji;
          p.connected = true;
          this.ensureHost(room);
          return { ok: true, playerId: p.id, token: p.token };
        }
      }
    }

    const id = newToken();
    const tok = newToken();
    room.players.set(id, { id, name: identity.name, color: identity.color, emoji: identity.emoji, connected: true, token: tok });
    this.ensureHost(room);
    return { ok: true, playerId: id, token: tok };
  }

  setIdentity(code: string, playerId: string, identity: Identity): void {
    const p = this.rooms.get(code)?.players.get(playerId);
    if (p) { p.name = identity.name; p.color = identity.color; p.emoji = identity.emoji; }
  }

  setConnected(code: string, playerId: string, connected: boolean): void {
    const room = this.rooms.get(code);
    const p = room?.players.get(playerId);
    if (!room || !p) return;
    p.connected = connected;
    if (!connected && room.hostId === playerId) room.hostId = this.oldestConnected(room);
    else if (connected) this.ensureHost(room);
  }

  private ensureHost(room: Room): void {
    if (room.hostId && room.players.get(room.hostId)?.connected) return;
    room.hostId = this.oldestConnected(room);
  }
  private oldestConnected(room: Room): string | null {
    for (const p of room.players.values()) if (p.connected) return p.id;
    return null;
  }

  hostId(code: string): string | null { return this.rooms.get(code)?.hostId ?? null; }
  isHost(code: string, playerId: string): boolean { return this.rooms.get(code)?.hostId === playerId; }

  transferHost(code: string, fromId: string, toId: string): boolean {
    const room = this.rooms.get(code);
    if (!room || room.hostId !== fromId) return false;
    const target = room.players.get(toId);
    if (!target || !target.connected) return false;
    room.hostId = toId;
    return true;
  }

  mode(code: string): RoomMode { return this.rooms.get(code)?.mode ?? "lobby"; }
  currentGameId(code: string): string | null { return this.rooms.get(code)?.currentGameId ?? null; }
  cursorIndex(code: string): number { return this.rooms.get(code)?.cursorIndex ?? 0; }

  setMode(code: string, mode: RoomMode, gameId: string | null): void {
    const room = this.rooms.get(code);
    if (!room) return;
    room.mode = mode;
    room.currentGameId = gameId;
  }

  moveCursor(code: string, dir: "up" | "down" | "left" | "right", count: number): void {
    const room = this.rooms.get(code);
    if (!room || count <= 0) return;
    const delta = dir === "left" || dir === "up" ? -1 : 1;
    room.cursorIndex = Math.min(count - 1, Math.max(0, room.cursorIndex + delta));
  }
  focusCursor(code: string, index: number, count: number): void {
    const room = this.rooms.get(code);
    if (!room || count <= 0) return;
    room.cursorIndex = Math.min(count - 1, Math.max(0, index));
  }

  connectedPlayers(code: string): Player[] {
    const room = this.rooms.get(code);
    if (!room) return [];
    return [...room.players.values()].filter((p) => p.connected).map(({ token, ...pub }) => pub);
  }
  players(code: string): Player[] {
    const room = this.rooms.get(code);
    if (!room) return [];
    return [...room.players.values()].map(({ token, ...pub }) => pub);
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm vitest run apps/server/src/rooms.test.ts`
Expected: PASS.

- [ ] **Step 5: Stage changes (do NOT commit)** - stage the two rooms files.

---

### Task 4: Server - registry, lobby/in-game wiring, control messages, broadcasts

**Files:**
- Modify: `apps/server/src/server.ts`
- Modify: `apps/server/src/index.ts`
- Modify: `apps/server/src/server.test.ts`
- Replace: `apps/server/src/server.game.test.ts` -> delete, create `apps/server/src/server.lobby.test.ts`
- Modify: `apps/server/src/server.uttt.test.ts`

**Interfaces:**
- Consumes: `RoomManager` (Task 3), `gameSummaries`/`GameRegistry`/`GameInstance`/`PlayerInfo` from `@hubbub/sdk` (Task 2), `parseClientMessage`/`ServerMessage` from `@hubbub/protocol` (Task 1).
- Produces: `createServer(port: number, games: GameRegistry)` returning `{ wss, close }`. New broadcast `roomState` (lobby context) + `gameState{gameId}`.

- [ ] **Step 1: Implement the new server**

Replace `apps/server/src/server.ts` with:
```ts
import { WebSocketServer, type WebSocket } from "ws";
import { parseClientMessage, type ServerMessage } from "@hubbub/protocol";
import { GameInstance, gameSummaries, type GameRegistry, type PlayerInfo } from "@hubbub/sdk";
import { RoomManager } from "./rooms.js";

interface ConnState { roomCode?: string; playerId?: string; role?: "screen" | "controller"; }

export function createServer(port: number, games: GameRegistry) {
  const wss = new WebSocketServer({ port });
  const rooms = new RoomManager();
  const sockets = new Map<string, Set<WebSocket>>();
  const instances = new Map<string, GameInstance<any, any>>();
  const state = new WeakMap<WebSocket, ConnState>();
  const summaries = gameSummaries(games);
  const count = summaries.length;

  const send = (ws: WebSocket, msg: ServerMessage) => ws.send(JSON.stringify(msg));
  const broadcast = (code: string, msg: ServerMessage) => sockets.get(code)?.forEach((ws) => send(ws, msg));

  function broadcastRoomState(code: string) {
    broadcast(code, {
      t: "roomState",
      players: rooms.players(code),
      hostId: rooms.hostId(code),
      mode: rooms.mode(code),
      currentGameId: rooms.currentGameId(code),
      cursorIndex: rooms.cursorIndex(code),
      games: summaries,
    });
  }
  function broadcastGameState(code: string) {
    const inst = instances.get(code);
    const gameId = rooms.currentGameId(code);
    if (!inst || !gameId) return;
    broadcast(code, { t: "gameState", gameId, state: inst.get() });
  }
  const connectedInfo = (code: string): PlayerInfo[] =>
    rooms.connectedPlayers(code).map((p) => ({ id: p.id, name: p.name }));

  function launchAtCursor(code: string) {
    const summary = summaries[rooms.cursorIndex(code)];
    if (!summary) return;
    const players = connectedInfo(code);
    if (players.length < summary.minPlayers) return;
    instances.set(code, new GameInstance(games[summary.id], players));
    rooms.setMode(code, "in-game", summary.id);
    broadcastRoomState(code);
    broadcastGameState(code);
  }

  wss.on("connection", (ws) => {
    state.set(ws, {});
    ws.on("message", (raw) => {
      let msg;
      try { msg = parseClientMessage(raw.toString()); }
      catch { send(ws, { t: "error", code: "bad_message", message: "Invalid message" }); return; }
      const cs = state.get(ws)!;

      if (msg.t === "createRoom") {
        const code = rooms.createRoom();
        cs.role = "screen"; cs.roomCode = code;
        sockets.set(code, new Set([ws]));
        send(ws, { t: "roomCreated", code });
        broadcastRoomState(code);
        return;
      }

      if (msg.t === "joinRoom") {
        const result = rooms.join(msg.code, { name: msg.name, color: msg.color, emoji: msg.emoji }, msg.token);
        if (!result.ok) { send(ws, { t: "error", code: result.code, message: result.message }); return; }
        cs.role = "controller"; cs.roomCode = msg.code; cs.playerId = result.playerId;
        sockets.get(msg.code)?.add(ws);
        send(ws, { t: "joined", playerId: result.playerId, token: result.token });
        broadcastRoomState(msg.code);
        if (rooms.mode(msg.code) === "in-game") broadcastGameState(msg.code);
        return;
      }

      const code = cs.roomCode;
      if (!code) return;

      if (msg.t === "setIdentity") {
        if (!cs.playerId) return;
        rooms.setIdentity(code, cs.playerId, { name: msg.name, color: msg.color, emoji: msg.emoji });
        broadcastRoomState(code);
        return;
      }

      if (msg.t === "lobbyNav" || msg.t === "lobbyFocus" || msg.t === "lobbyConfirm" || msg.t === "returnToLobby" || msg.t === "transferHost") {
        if (!cs.playerId || !rooms.isHost(code, cs.playerId)) return;
        if (msg.t === "lobbyNav") {
          if (rooms.mode(code) !== "lobby") return;
          rooms.moveCursor(code, msg.dir, count);
          broadcastRoomState(code);
        } else if (msg.t === "lobbyFocus") {
          if (rooms.mode(code) !== "lobby") return;
          rooms.focusCursor(code, msg.index, count);
          broadcastRoomState(code);
        } else if (msg.t === "lobbyConfirm") {
          if (rooms.mode(code) !== "lobby") return;
          launchAtCursor(code);
        } else if (msg.t === "returnToLobby") {
          instances.delete(code);
          rooms.setMode(code, "lobby", null);
          broadcastRoomState(code);
        } else if (msg.t === "transferHost") {
          if (rooms.transferHost(code, cs.playerId, msg.toPlayerId)) broadcastRoomState(code);
        }
        return;
      }

      if (msg.t === "action") {
        if (!cs.playerId || rooms.mode(code) !== "in-game") return;
        const inst = instances.get(code);
        if (!inst) return;
        inst.applyAction(cs.playerId, msg.payload);
        broadcastGameState(code);
        return;
      }
    });

    ws.on("close", () => {
      const cs = state.get(ws);
      if (!cs?.roomCode) return;
      sockets.get(cs.roomCode)?.delete(ws);
      if (cs.role === "controller" && cs.playerId) {
        rooms.setConnected(cs.roomCode, cs.playerId, false);
        broadcastRoomState(cs.roomCode);
      }
    });
  });

  return {
    wss,
    close: () => new Promise<void>((resolve) => {
      wss.clients.forEach((c) => c.terminate());
      wss.close(() => resolve());
    }),
  };
}
```

- [ ] **Step 2: Update the standalone entrypoint**

Replace `apps/server/src/index.ts` with:
```ts
import { createServer } from "./server.js";
import { tttLogic } from "@hubbub/game-tictactoe";
import { utttLogic } from "@hubbub/game-ultimate-tictactoe";
import type { GameRegistry } from "@hubbub/sdk";

const games: GameRegistry = { ttt: tttLogic, uttt: utttLogic };
const port = Number(process.env.PORT ?? 7787);
createServer(port, games);
console.log(`Hubbub server on ws://0.0.0.0:${port} (games: ${Object.keys(games).join(", ")})`);
```

- [ ] **Step 3: Update the bare-room server test**

Replace `apps/server/src/server.test.ts` with:
```ts
import { describe, it, expect, afterEach } from "vitest";
import { WebSocket } from "ws";
import { createServer } from "./server.js";

let handle: ReturnType<typeof createServer> | undefined;
afterEach(async () => await handle?.close());

const open = (port: number) =>
  new Promise<WebSocket>((res) => {
    const ws = new WebSocket(`ws://localhost:${port}`);
    ws.on("open", () => res(ws));
  });
const nextOf = (ws: WebSocket, t: string) =>
  new Promise<any>((res) => {
    const h = (m: any) => {
      const msg = JSON.parse(m.toString());
      if (msg.t === t) { ws.off("message", h); res(msg); }
    };
    ws.on("message", h);
  });

describe("createServer", () => {
  it("creates a room then a controller joins and the screen sees the player + lobby context", async () => {
    handle = createServer(0, {});
    const port = (handle.wss.address() as { port: number }).port;

    const screen = await open(port);
    screen.send(JSON.stringify({ t: "createRoom" }));
    const created = await nextOf(screen, "roomCreated");
    expect(created.code).toHaveLength(4);

    const controller = await open(port);
    controller.send(JSON.stringify({ t: "joinRoom", code: created.code, name: "Joe", color: "#4363d8", emoji: "🦊" }));
    const joined = await nextOf(controller, "joined");

    const room = await nextOf(screen, "roomState");
    expect(room.mode).toBe("lobby");
    expect(room.hostId).toBe(joined.playerId);
    expect(room.players).toEqual([
      { id: joined.playerId, name: "Joe", color: "#4363d8", emoji: "🦊", connected: true },
    ]);

    screen.close();
    controller.close();
  });
});
```

- [ ] **Step 4: Replace the counter-game test with a lobby-mechanics test**

Delete `apps/server/src/server.game.test.ts`. Create `apps/server/src/server.lobby.test.ts`:
```ts
import { describe, it, expect, afterEach } from "vitest";
import { WebSocket } from "ws";
import { z } from "zod";
import type { GameLogic, GameRegistry } from "@hubbub/sdk";
import { createServer } from "./server.js";

interface S { count: number; owner: string | null }
const counter: GameLogic<S, { by: number }> = {
  meta: { name: "Counter", minPlayers: 1 },
  actionSchema: z.object({ by: z.number() }),
  init: (p) => ({ count: 0, owner: p[0]?.id ?? null }),
  onAction: (s, id, a) => (id === s.owner ? { ...s, count: s.count + a.by } : s),
  onPlayersChanged: (s) => s,
};
const two: GameLogic<{ ok: boolean }, {}> = {
  meta: { name: "NeedsTwo", minPlayers: 2 },
  actionSchema: z.object({}),
  init: () => ({ ok: true }),
  onAction: (s) => s,
  onPlayersChanged: (s) => s,
};
const registry: GameRegistry = { counter, two }; // index 0 = counter, 1 = two

let handle: ReturnType<typeof createServer> | undefined;
afterEach(async () => await handle?.close());

const open = (port: number) =>
  new Promise<WebSocket>((res) => { const ws = new WebSocket(`ws://localhost:${port}`); ws.on("open", () => res(ws)); });
const nextOf = (ws: WebSocket, t: string) =>
  new Promise<any>((res, rej) => {
    const timer = setTimeout(() => rej(new Error(`timeout ${t}`)), 4000);
    const h = (m: any) => { const msg = JSON.parse(m.toString()); if (msg.t === t) { clearTimeout(timer); ws.off("message", h); res(msg); } };
    ws.on("message", h);
  });
// resolve after `ms` with the LAST roomState seen (for asserting no-op host gating)
const settle = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function setup() {
  handle = createServer(0, registry);
  const port = (handle.wss.address() as { port: number }).port;
  const screen = await open(port);
  screen.send(JSON.stringify({ t: "createRoom" }));
  const created = await nextOf(screen, "roomCreated");
  return { port, screen, code: created.code };
}
const join = (ws: WebSocket, code: string, name: string) =>
  ws.send(JSON.stringify({ t: "joinRoom", code, name, color: "#fff", emoji: "🐱" }));

describe("lobby mechanics", () => {
  it("first joiner is host, second is not; non-host confirm is ignored", async () => {
    const { port, screen, code } = await setup();
    const host = await open(port); join(host, code, "Ann");
    const hj = await nextOf(host, "joined");
    const guest = await open(port); join(guest, code, "Bo");
    await nextOf(guest, "joined");
    let room = await nextOf(screen, "roomState");
    expect(room.hostId).toBe(hj.playerId);

    // non-host tries to launch -> ignored (still lobby)
    guest.send(JSON.stringify({ t: "lobbyConfirm" }));
    await settle(150);
    // host navigates to the counter (index 0 already) and launches
    host.send(JSON.stringify({ t: "lobbyConfirm" }));
    const gs = await nextOf(screen, "gameState");
    expect(gs.gameId).toBe("counter");
    screen.close(); host.close(); guest.close();
  });

  it("lobbyNav moves the cursor and lobbyConfirm launches the highlighted game", async () => {
    const { port, screen, code } = await setup();
    const host = await open(port); join(host, code, "Ann"); await nextOf(host, "joined");
    const guest = await open(port); join(guest, code, "Bo"); await nextOf(guest, "joined");
    host.send(JSON.stringify({ t: "lobbyNav", dir: "right" })); // -> index 1 (two)
    const moved = await nextOf(screen, "roomState");
    expect(moved.cursorIndex).toBe(1);
    host.send(JSON.stringify({ t: "lobbyConfirm" }));
    const gs = await nextOf(screen, "gameState");
    expect(gs.gameId).toBe("two");
    screen.close(); host.close(); guest.close();
  });

  it("cannot launch a game needing more players than are connected", async () => {
    const { port, screen, code } = await setup();
    const host = await open(port); join(host, code, "Ann"); await nextOf(host, "joined");
    host.send(JSON.stringify({ t: "lobbyFocus", index: 1 })); // 'two' needs 2 players
    await nextOf(screen, "roomState");
    host.send(JSON.stringify({ t: "lobbyConfirm" }));
    await settle(200); // no game should start
    // focusing back to counter (minPlayers 1) launches fine with the single host
    host.send(JSON.stringify({ t: "lobbyFocus", index: 0 }));
    await nextOf(screen, "roomState");
    host.send(JSON.stringify({ t: "lobbyConfirm" }));
    const gs = await nextOf(screen, "gameState");
    expect(gs.gameId).toBe("counter");
    screen.close(); host.close();
  });

  it("routes actions in-game and returns to lobby on host returnToLobby", async () => {
    const { port, screen, code } = await setup();
    const host = await open(port); join(host, code, "Ann"); await nextOf(host, "joined");
    host.send(JSON.stringify({ t: "lobbyConfirm" })); // counter (index 0), 1 player ok
    const gs = await nextOf(screen, "gameState");
    expect(gs.state.count).toBe(0);
    host.send(JSON.stringify({ t: "action", payload: { by: 5 } }));
    const after = await nextOf(screen, "gameState");
    expect(after.state.count).toBe(5);
    host.send(JSON.stringify({ t: "returnToLobby" }));
    const room = await nextOf(screen, "roomState");
    expect(room.mode).toBe("lobby");
    screen.close(); host.close();
  });

  it("migrates host when the host disconnects", async () => {
    const { port, screen, code } = await setup();
    const host = await open(port); join(host, code, "Ann"); const hj = await nextOf(host, "joined");
    const guest = await open(port); join(guest, code, "Bo"); const gj = await nextOf(guest, "joined");
    await nextOf(screen, "roomState");
    host.close();
    let room = await nextOf(screen, "roomState");
    // the disconnect may arrive before host migration broadcast; read until host changes
    while (room.hostId === hj.playerId) room = await nextOf(screen, "roomState");
    expect(room.hostId).toBe(gj.playerId);
    screen.close(); guest.close();
  });
});
```

- [ ] **Step 5: Rewrite the uttt integration test to the lobby flow + full session**

Replace `apps/server/src/server.uttt.test.ts` with:
```ts
import { describe, it, expect, afterEach } from "vitest";
import { WebSocket } from "ws";
import { tttLogic } from "@hubbub/game-tictactoe";
import { utttLogic } from "@hubbub/game-ultimate-tictactoe";
import type { GameRegistry } from "@hubbub/sdk";
import { createServer } from "./server.js";

const registry: GameRegistry = { ttt: tttLogic, uttt: utttLogic }; // index 0 = ttt, 1 = uttt

let handle: ReturnType<typeof createServer> | undefined;
afterEach(async () => await handle?.close());

const open = (port: number) =>
  new Promise<WebSocket>((res) => { const ws = new WebSocket(`ws://localhost:${port}`); ws.on("open", () => res(ws)); });
const nextOf = (ws: WebSocket, t: string) =>
  new Promise<any>((res, rej) => {
    const timer = setTimeout(() => rej(new Error(`timeout ${t}`)), 4000);
    const h = (m: any) => { const msg = JSON.parse(m.toString()); if (msg.t === t) { clearTimeout(timer); ws.off("message", h); res(msg); } };
    ws.on("message", h);
  });
const join = (ws: WebSocket, code: string, name: string) =>
  ws.send(JSON.stringify({ t: "joinRoom", code, name, color: "#fff", emoji: "🐱" }));

describe("lobby session with real games", () => {
  it("launches ttt, returns to lobby, then launches uttt with the same players", async () => {
    handle = createServer(0, registry);
    const port = (handle.wss.address() as { port: number }).port;
    const screen = await open(port);
    screen.send(JSON.stringify({ t: "createRoom" }));
    const created = await nextOf(screen, "roomCreated");

    const host = await open(port); join(host, created.code, "Ann"); await nextOf(host, "joined");
    const guest = await open(port); join(guest, created.code, "Bo"); await nextOf(guest, "joined");

    // launch ttt (index 0)
    host.send(JSON.stringify({ t: "lobbyConfirm" }));
    const ttt = await nextOf(screen, "gameState");
    expect(ttt.gameId).toBe("ttt");
    expect(ttt.state.board).toHaveLength(9);

    // back to lobby
    host.send(JSON.stringify({ t: "returnToLobby" }));
    let room = await nextOf(screen, "roomState");
    while (room.mode !== "lobby") room = await nextOf(screen, "roomState");
    expect(room.players.map((p: any) => p.name).sort()).toEqual(["Ann", "Bo"]);

    // navigate to uttt (index 1) and launch
    host.send(JSON.stringify({ t: "lobbyNav", dir: "right" }));
    await nextOf(screen, "roomState");
    host.send(JSON.stringify({ t: "lobbyConfirm" }));
    const uttt = await nextOf(screen, "gameState");
    expect(uttt.gameId).toBe("uttt");
    expect(uttt.state.boards).toHaveLength(9);

    screen.close(); host.close(); guest.close();
  });
});
```

- [ ] **Step 6: Install + verify**

Run: `pnpm install` (no new deps, but refreshes workspace graph), then:
- `pnpm vitest run apps/server/src` - all server tests PASS.
- `pnpm --filter @hubbub/server typecheck` - no errors.

- [ ] **Step 7: Stage changes (do NOT commit)** - stage `server.ts`, `index.ts`, `server.test.ts`, `server.lobby.test.ts`, the deletion of `server.game.test.ts`, `server.uttt.test.ts`, and `pnpm-lock.yaml` if changed.

---

### Task 5: Screen app - landing-page lobby + mode routing + dynamic registry

**Files:**
- Create: `apps/screen/src/lobby.tsx`
- Modify: `apps/screen/src/game.tsx`
- Modify: `apps/screen/src/App.tsx`

**Interfaces:**
- Consumes: `roomState` (with `players`, `hostId`, `mode`, `currentGameId`, `cursorIndex`, `games`) and `gameState` (`gameId`, `state`) from the server.
- Produces: `getScreen(gameId): ComponentType<{ state: any }>` from `game.tsx`; `<Lobby>` component.

This task is presentational + wiring. Mirror the existing game screen views (`packages/games/tictactoe/src/screen.tsx`, `packages/games/ultimate-tictactoe/src/screen.tsx`) for JSX style. No unit tests for views (consistent with the existing pattern); verify with typecheck + build.

- [ ] **Step 1: Generalize the screen registry to a lookup**

Replace `apps/screen/src/game.tsx` with:
```tsx
import type { ComponentType } from "react";
import { TTTScreen } from "@hubbub/game-tictactoe/screen";
import { UTTTScreen } from "@hubbub/game-ultimate-tictactoe/screen";

type ScreenComponent = ComponentType<{ state: any }>;

const SCREENS: Record<string, ScreenComponent> = {
  ttt: TTTScreen as ScreenComponent,
  uttt: UTTTScreen as ScreenComponent,
};

export function getScreen(gameId: string | null): ScreenComponent | null {
  return gameId ? SCREENS[gameId] ?? null : null;
}
```

- [ ] **Step 2: Build the Lobby view**

Create `apps/screen/src/lobby.tsx`. It receives the lobby context + room code + controller URL and renders: a featured-games carousel banner (the `games.filter(g => g.featured)` row), a navigable game grid with the tile at `cursorIndex` highlighted (green border like the game views' active style), the room `code`, a join QR (use the existing `qrcode` dependency, mirroring `App.tsx`'s current `QRCode.toDataURL` usage), and a player roster showing each player's `emoji`, a `color` swatch, `name`, and a host badge when `player.id === hostId`. Games whose `minPlayers` exceeds the connected-player count render dimmed/disabled.

```tsx
import type { GameSummary, Player } from "@hubbub/protocol";

export function Lobby({
  code, qr, controllerLabel, players, hostId, games, cursorIndex,
}: {
  code: string;
  qr: string;
  controllerLabel: string;
  players: Player[];
  hostId: string | null;
  games: GameSummary[];
  cursorIndex: number;
}) {
  const connectedCount = players.filter((p) => p.connected).length;
  const featured = games.filter((g) => g.featured);

  return (
    <div style={{ fontFamily: "system-ui", textAlign: "center" }}>
      {featured.length > 0 && (
        <div style={{ display: "flex", gap: 12, overflowX: "auto", padding: "8px 16px", justifyContent: "center" }}>
          {featured.map((g) => (
            <div key={g.id} style={{ minWidth: 180, padding: 16, border: "2px solid #ddd", borderRadius: 12, background: "#fafafa" }}>
              <strong>{g.name}</strong>
              <div style={{ fontSize: 12, color: "#777" }}>{g.minPlayers}{g.maxPlayers ? `-${g.maxPlayers}` : "+"} players</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, maxWidth: 540, margin: "16px auto" }}>
        {games.map((g, i) => {
          const playable = connectedCount >= g.minPlayers;
          const focused = i === cursorIndex;
          return (
            <div key={g.id} style={{
              padding: 20,
              border: focused ? "3px solid #22aa77" : "2px solid #ccc",
              borderRadius: 12,
              opacity: playable ? 1 : 0.45,
              background: focused ? "#eafff6" : "#fff",
            }}>
              <div style={{ fontSize: 18, fontWeight: 600 }}>{g.name}</div>
              <div style={{ fontSize: 12, color: "#777" }}>
                {g.minPlayers}{g.maxPlayers ? `-${g.maxPlayers}` : "+"} players{playable ? "" : " - need more"}
              </div>
            </div>
          );
        })}
      </div>

      <p>Join at <strong>{controllerLabel}</strong></p>
      <h2 style={{ fontSize: 48, letterSpacing: 8 }}>{code || "…"}</h2>
      {qr && <img src={qr} alt="Join QR" width={180} height={180} />}

      <h3>Players ({connectedCount})</h3>
      <ul style={{ listStyle: "none", padding: 0, display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
        {players.map((p) => (
          <li key={p.id} style={{ opacity: p.connected ? 1 : 0.4, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 22 }}>{p.emoji}</span>
            <span style={{ width: 12, height: 12, borderRadius: "50%", background: p.color, display: "inline-block" }} />
            <span>{p.name}</span>
            {p.id === hostId && <span title="Host" style={{ fontSize: 12, color: "#22aa77" }}>★ host</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 3: Rewire the screen App to route on mode**

Rewrite `apps/screen/src/App.tsx` to: connect, `createRoom`, and track two pieces of state - the latest `roomState` (call it `room`) and the latest `gameState` (`game`). On `roomCreated` set `code` and build the QR (`QRCode.toDataURL(\`${CONTROLLER_URL}/?room=${code}\`)`). On `roomState` store `room`; on `gameState` store `{ gameId, state }`. Render: if `room?.mode === "in-game"` and `getScreen(game?.gameId)` resolves, render that screen with `game.state`; otherwise render `<Lobby>` from `room` (passing `code`, `qr`, `CONTROLLER_URL.replace(/^https?:\/\//, "")`, `room.players`, `room.hostId`, `room.games`, `room.cursorIndex`). Keep the existing transport setup/teardown. Remove all `VITE_GAME`, `TTTScreen`, and `TTTState` references.

Reference structure (fill in using the current `App.tsx` transport boilerplate):
```tsx
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { WebSocketClientTransport } from "@hubbub/protocol";
import { getScreen } from "./game";
import { Lobby } from "./lobby";
import { SERVER_URL, CONTROLLER_URL } from "./config";
// Subscribe to t.onMessage directly (Step 4, approach a); two useState slots: room, game.
// ...component body per the description above
```

- [ ] **Step 4: Decide the message-subscription approach**

The current `App.tsx` uses `useGameState(transport)` (from `@hubbub/sdk/react`) which only tracks `gameState`. The lobby needs `roomState` too. Read `apps/screen/src/` and `packages/sdk/src/react.*` (the `useGameState` hook) to see the existing pattern, then EITHER:
  - (a) subscribe to messages directly in a `useEffect` with two `useState`s (`room`, `game`) - simplest, and what this task assumes; or
  - (b) extend the SDK react helper to also expose room state.

Prefer (a) to keep the SDK helper unchanged. Implement the `t.onMessage` handler to switch on `msg.t` (`roomCreated` | `roomState` | `gameState`).

- [ ] **Step 5: Verify**

Run: `pnpm --filter @hubbub/screen typecheck` (no errors) and `pnpm --filter @hubbub/screen build` (succeeds).

- [ ] **Step 6: Stage changes (do NOT commit)** - stage `lobby.tsx`, `game.tsx`, `App.tsx`.

---

### Task 6: Controller app - identity/settings + lobby controller + in-game + back-to-lobby

**Files:**
- Create: `apps/controller/src/identity.ts`
- Create: `apps/controller/src/settings.tsx`
- Create: `apps/controller/src/lobby.tsx`
- Modify: `apps/controller/src/game.tsx`
- Modify: `apps/controller/src/App.tsx`

**Interfaces:**
- Consumes: `roomState` + `gameState` from the server; identity from `localStorage`.
- Produces: `getController(gameId): ComponentType<{ state; playerId; send }>`; `loadIdentity()/saveIdentity()`; `PALETTE`, `EMOJIS`; `<Settings>`, `<ControllerLobby>`.

Presentational + localStorage + message wiring. Mirror `packages/games/*/src/controller.tsx` for JSX style. No unit tests for views; verify with typecheck + build.

- [ ] **Step 1: Identity storage + offline constants**

Create `apps/controller/src/identity.ts`:
```ts
export interface Identity { name: string; color: string; emoji: string; }

const KEY = "hubbub:identity";

// Offline-safe: hex strings + system unicode emoji. Never CDN-loaded.
export const PALETTE = ["#e6194B", "#3cb44b", "#ffe119", "#4363d8", "#f58231", "#911eb4", "#42d4f4", "#f032e6"];
export const EMOJIS = ["😀", "😎", "🐱", "🐶", "🦊", "🐼", "🐸", "🐵", "🦄", "🐙", "🍕", "🍔", "🚀", "⚡", "🌟", "🎮"];

export function loadIdentity(): Identity | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (typeof v?.name === "string" && typeof v?.color === "string" && typeof v?.emoji === "string") return v;
    return null;
  } catch { return null; }
}

export function saveIdentity(id: Identity): void {
  localStorage.setItem(KEY, JSON.stringify(id));
}
```

- [ ] **Step 2: Settings screen**

Create `apps/controller/src/settings.tsx`: a form with a name input, a row of `PALETTE` color swatches (selected one ringed), and a grid of `EMOJIS` (selected one ringed), plus a Save button (disabled until name is non-empty). Calls `onSave(identity)`. Pre-fill from an optional `initial` prop; when absent, default `color = PALETTE[0]`, `emoji = EMOJIS[0]`, `name = ""`.

```tsx
import { useState, type CSSProperties } from "react";
import { PALETTE, EMOJIS, type Identity } from "./identity";

export function Settings({ initial, onSave, onCancel }: { initial?: Identity; onSave: (id: Identity) => void; onCancel?: () => void; }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [color, setColor] = useState(initial?.color ?? PALETTE[0]);
  const [emoji, setEmoji] = useState(initial?.emoji ?? EMOJIS[0]);

  return (
    <main style={ui}>
      <h1>You</h1>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" maxLength={24} style={input} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
        {PALETTE.map((c) => (
          <button key={c} onClick={() => setColor(c)} aria-label={c}
            style={{ width: 36, height: 36, borderRadius: "50%", background: c, border: c === color ? "3px solid #222" : "2px solid #ccc" }} />
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 6 }}>
        {EMOJIS.map((e) => (
          <button key={e} onClick={() => setEmoji(e)} style={{ fontSize: 22, padding: 4, border: e === emoji ? "3px solid #222" : "2px solid #eee", borderRadius: 8 }}>{e}</button>
        ))}
      </div>
      <button disabled={name.trim() === ""} onClick={() => onSave({ name: name.trim(), color, emoji })} style={button}>Save</button>
      {onCancel && <button onClick={onCancel} style={{ ...button, background: "#eee" }}>Cancel</button>}
    </main>
  );
}

const ui: CSSProperties = { fontFamily: "system-ui", display: "flex", flexDirection: "column", gap: 16, padding: 24, maxWidth: 360, margin: "0 auto", textAlign: "center" };
const input: CSSProperties = { fontSize: 24, padding: 12, textAlign: "center" };
const button: CSSProperties = { fontSize: 20, padding: 12 };
```

- [ ] **Step 3: Generalize the controller registry to a lookup**

Replace `apps/controller/src/game.tsx` with:
```tsx
import type { ComponentType } from "react";
import { TTTController } from "@hubbub/game-tictactoe/controller";
import { UTTTController } from "@hubbub/game-ultimate-tictactoe/controller";

type ControllerComponent = ComponentType<{ state: any; playerId: string; send: (a: any) => void }>;

const CONTROLLERS: Record<string, ControllerComponent> = {
  ttt: TTTController as ControllerComponent,
  uttt: UTTTController as ControllerComponent,
};

export function getController(gameId: string | null): ControllerComponent | null {
  return gameId ? CONTROLLERS[gameId] ?? null : null;
}
```

- [ ] **Step 4: Controller lobby view (host D-pad + tiles + transfer; non-host waiting)**

Create `apps/controller/src/lobby.tsx`. Props: `{ players, hostId, games, cursorIndex, playerId, isHost, onNav, onFocus, onConfirm, onTransferHost, onOpenSettings }`.
  - Host: a D-pad (`↑ ↓ ← →` buttons calling `onNav(dir)`), a big **Confirm** button (`onConfirm()`), a list of game tiles (tap calls `onFocus(index)` then `onConfirm()`), a roster where tapping another connected player offers "Make host" (`onTransferHost(id)`), and a settings (gear) button.
  - Non-host: "Waiting for the host to pick a game", the roster, and a settings button.
  - Disable a tile / show "need more players" when `connectedCount < game.minPlayers`.

```tsx
import type { GameSummary, Player } from "@hubbub/protocol";

type Dir = "up" | "down" | "left" | "right";
export function ControllerLobby({
  players, hostId, games, cursorIndex, playerId, isHost,
  onNav, onFocus, onConfirm, onTransferHost, onOpenSettings,
}: {
  players: Player[]; hostId: string | null; games: GameSummary[]; cursorIndex: number;
  playerId: string; isHost: boolean;
  onNav: (d: Dir) => void; onFocus: (i: number) => void; onConfirm: () => void;
  onTransferHost: (id: string) => void; onOpenSettings: () => void;
}) {
  const connectedCount = players.filter((p) => p.connected).length;
  return (
    <main style={{ fontFamily: "system-ui", padding: 16, maxWidth: 380, margin: "0 auto", textAlign: "center" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <strong>{isHost ? "You are host" : "Lobby"}</strong>
        <button onClick={onOpenSettings} aria-label="Settings" style={{ fontSize: 18 }}>⚙</button>
      </div>

      {isHost ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 48px)", gap: 6, justifyContent: "center", margin: "12px auto" }}>
            <span /><button onClick={() => onNav("up")} style={dpad}>↑</button><span />
            <button onClick={() => onNav("left")} style={dpad}>←</button>
            <button onClick={onConfirm} style={{ ...dpad, background: "#22aa77", color: "#fff" }}>OK</button>
            <button onClick={() => onNav("right")} style={dpad}>→</button>
            <span /><button onClick={() => onNav("down")} style={dpad}>↓</button><span />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
            {games.map((g, i) => {
              const playable = connectedCount >= g.minPlayers;
              return (
                <button key={g.id} disabled={!playable}
                  onClick={() => { onFocus(i); onConfirm(); }}
                  style={{ padding: 12, border: i === cursorIndex ? "3px solid #22aa77" : "2px solid #ccc", borderRadius: 10, opacity: playable ? 1 : 0.5 }}>
                  <div style={{ fontWeight: 600 }}>{g.name}</div>
                  <div style={{ fontSize: 11, color: "#777" }}>{g.minPlayers}{g.maxPlayers ? `-${g.maxPlayers}` : "+"}</div>
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <p style={{ margin: "24px 0" }}>Waiting for the host to pick a game…</p>
      )}

      <h3>Players ({connectedCount})</h3>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {players.map((p) => (
          <li key={p.id} style={{ opacity: p.connected ? 1 : 0.4, display: "flex", gap: 8, alignItems: "center", justifyContent: "center", margin: 4 }}>
            <span style={{ fontSize: 20 }}>{p.emoji}</span>
            <span style={{ width: 12, height: 12, borderRadius: "50%", background: p.color }} />
            <span>{p.name}{p.id === playerId ? " (you)" : ""}</span>
            {p.id === hostId && <span style={{ fontSize: 11, color: "#22aa77" }}>★</span>}
            {isHost && p.connected && p.id !== playerId && (
              <button onClick={() => onTransferHost(p.id)} style={{ fontSize: 11 }}>Make host</button>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}

const dpad = { fontSize: 20, padding: 8, border: "2px solid #ccc", borderRadius: 8 } as const;
```

- [ ] **Step 5: Rewire the controller App**

Rewrite `apps/controller/src/App.tsx`:
  - On load, `loadIdentity()`. If null, render `<Settings onSave={(id) => { saveIdentity(id); setIdentity(id); }}>` BEFORE joining. (No name re-prompt on later visits.)
  - Once identity exists, auto-show a Join screen (room code from `?room=` like today, but NO name field - identity is saved). On Join, connect and `send({ t: "joinRoom", code, name, color, emoji, token })` where `token = localStorage.getItem(\`hubbub:token:${code}\`)`.
  - Track `room` (roomState) and `game` (gameState) by subscribing to `t.onMessage` (same direct-subscription approach as Task 5 Step 4). Store `playerId` from `joined`; persist token under `hubbub:token:${code}`.
  - `isHost = room?.hostId === playerId`.
  - Render routing once joined:
    - `room.mode === "lobby"` -> `<ControllerLobby ...>` with handlers sending `lobbyNav`/`lobbyFocus`/`lobbyConfirm`/`transferHost` and `onOpenSettings` toggling a settings overlay that on save sends `setIdentity` + `saveIdentity`.
    - `room.mode === "in-game"` -> `getController(game?.gameId)` rendered with `state={game.state}`, `playerId`, `send={createActionSender(transport)}`; plus, when `isHost`, a small **Back to lobby** button sending `returnToLobby`.
  - A gear/settings button is available in lobby and edits identity live (sends `setIdentity`, calls `saveIdentity`).
  - Remove all `VITE_GAME`, `TTTController`, `TTTState`, `TTTAction` references. Keep `createActionSender` from `@hubbub/sdk/react`.

- [ ] **Step 6: Verify**

Run: `pnpm --filter @hubbub/controller typecheck` (no errors) and `pnpm --filter @hubbub/controller build` (succeeds).

- [ ] **Step 7: Stage changes (do NOT commit)** - stage `identity.ts`, `settings.tsx`, `lobby.tsx`, `game.tsx`, `App.tsx`.

---

### Task 7: Electron host wiring + final verification

**Files:**
- Modify: `apps/host-desktop/src/host.ts`
- Modify: `apps/host-desktop/src/host.test.ts`
- Modify: `docs/PROJECT_STATE_AND_NEXT_STEPS.md` (commands note)

**Interfaces:**
- Consumes: `createServer(port, games)` (Task 4), `GameRegistry` from `@hubbub/sdk`.
- Produces: `startHost` now serves the full game registry (lobby), not a single game.

- [ ] **Step 1: Pass a registry to the host's ws server**

In `apps/host-desktop/src/host.ts`:
  - Replace the import `import { tttLogic } from "@hubbub/game-tictactoe";` and `import type { GameLogic } from "@hubbub/sdk";` with:
    ```ts
    import { tttLogic } from "@hubbub/game-tictactoe";
    import { utttLogic } from "@hubbub/game-ultimate-tictactoe";
    import type { GameRegistry } from "@hubbub/sdk";
    ```
  - In `HostOptions`, replace `game?: GameLogic<any, any>;` with `games?: GameRegistry;`.
  - Replace the ws creation line `const ws = createWsServer(opts.wsPort ?? 7787, opts.game ?? tttLogic);` with:
    ```ts
    const ws = createWsServer(opts.wsPort ?? 7787, opts.games ?? { ttt: tttLogic, uttt: utttLogic });
    ```
  - If `apps/host-desktop/package.json` does not already depend on `@hubbub/game-ultimate-tictactoe`, add `"@hubbub/game-ultimate-tictactoe": "workspace:*"` to its `dependencies` (it already depends on `@hubbub/game-tictactoe`).

- [ ] **Step 2: Update the host WS test to send identity**

In `apps/host-desktop/src/host.test.ts`, the WS test sends `joinRoom` with only `name`. Update that line to include identity so it parses:
```ts
phone.send(JSON.stringify({ t: "joinRoom", code: created.code, name: "Ada", color: "#4363d8", emoji: "🦊" }));
```
(The test only asserts `joined` arrives, which still holds in lobby mode.)

- [ ] **Step 3: Update the handoff doc's run note**

In `docs/PROJECT_STATE_AND_NEXT_STEPS.md`, update the "Run Ultimate TTT live" guidance: the `HUBBUB_GAME`/`VITE_GAME` env switches are retired; games are now chosen in the lobby (host picks). Change the relevant lines to say: "All games are bundled; pick a game from the lobby (host's controller). `pnpm dev:all` then open the screen; join two phones; the host launches Ultimate TTT from the lobby." Keep it to a few lines.

- [ ] **Step 4: Install + full-floor verification**

Run each as a separate command from the repo root:
- `pnpm install`
- `pnpm typecheck`  (all packages green)
- `pnpm test`       (all suites green; the previously-passing game-logic tests are unchanged)
- `pnpm build`      (all builds succeed, default no longer depends on any env switch)

- [ ] **Step 5: Stage changes (do NOT commit)** - stage `host.ts`, `host.test.ts`, `host-desktop/package.json` (if changed), `PROJECT_STATE_AND_NEXT_STEPS.md`, and `pnpm-lock.yaml` (if changed).

---

## Post-plan verification (orchestrator)

1. **Full floor:** `pnpm typecheck`, `pnpm test`, `pnpm build` all green from the repo root.
2. **Optional live Playwright check:** with the dev stack running, open the screen, join two controller tabs (clear `localStorage` between them to avoid the same-origin reconnect-token collision noted in `.for_bepy/BEPY_TODOS.md`), set identities, host launches a game, plays a move, returns to lobby, launches the other game. Confirm the lobby renders the carousel/grid/roster, the cursor highlight tracks `lobbyNav`, and game switching keeps both players.

## Open follow-ups (deferred, not in this plan)

- **Game suggestions** (non-host taps to suggest; surfaces on screen + host shortcut).
- **Mid-game join** (add late joiners to the running game via `onPlayersChanged`).
- **Geometry-aware 2D cursor nav** (current nav is linear over the games list).
- **Featured curation** (all games featured for now).
