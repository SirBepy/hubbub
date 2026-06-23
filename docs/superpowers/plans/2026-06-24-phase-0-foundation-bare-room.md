# Phase 0 - Foundation & Bare Room Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Hubbub monorepo and a bare room system so a phone can join a screen's room by code and its name appears live on the screen.

**Architecture:** TypeScript pnpm + Turborepo monorepo. A shared `protocol` package holds the message schemas (Zod discriminated union), a swappable `ClientTransport` interface, and reconnect-token helpers. A Node `ws` server owns rooms (4-letter codes, player list, reconnect-by-token) and broadcasts room state. Two thin React/Vite apps (`screen`, `controller`) connect through the transport interface.

**Tech Stack:** TypeScript (strict, ESM), pnpm workspaces, Turborepo, Vitest (pool: forks, singleFork), Zod, `ws`, React + Vite, built-in `crypto` for codes/tokens.

## Global Constraints

- Node 20+; TypeScript strict; ESM everywhere (`"type": "module"`).
- Concurrency capped at 5 (turbo `--concurrency=5`; Vitest `pool: 'forks'`, `poolOptions.forks.singleFork: true` for clean Windows exit).
- License MIT (already in repo). Codename `hubbub`.
- **Offline LAN = no CDNs.** All assets bundled, never CDN-loaded (applies from the first app, including any icon/font).
- Game/SDK/app code must NEVER import a concrete transport - only the `ClientTransport` interface (WebSocket is just the first impl).
- No fixed player cap in the framework.
- Stage changes per task; commit via the project `/commit` flow (never `git add -A`, stage by name).

---

### Task 1: Monorepo scaffolding

**Files:**
- Create: `pnpm-workspace.yaml`
- Create: `package.json` (root)
- Create: `turbo.json`
- Create: `tsconfig.base.json`
- Create: `vitest.config.ts` (root)
- Create: `packages/.gitkeep`, `apps/.gitkeep`

**Interfaces:**
- Produces: workspace globs `apps/*` and `packages/*`; root scripts `typecheck`, `test`, `build`, `dev`; shared `tsconfig.base.json` extended by every package.

- [ ] **Step 1: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [ ] **Step 2: Create root `package.json`**

```json
{
  "name": "hubbub",
  "private": true,
  "type": "module",
  "engines": { "node": ">=20" },
  "scripts": {
    "build": "turbo run build --concurrency=5",
    "dev": "turbo run dev --concurrency=5",
    "typecheck": "turbo run typecheck --concurrency=5",
    "test": "vitest run"
  },
  "devDependencies": {
    "turbo": "^2.1.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 3: Create `turbo.json`**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] },
    "typecheck": { "dependsOn": ["^build"] },
    "dev": { "cache": false, "persistent": true }
  }
}
```

- [ ] **Step 4: Create `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "verbatimModuleSyntax": true,
    "types": ["vitest/globals"]
  }
}
```

- [ ] **Step 5: Create root `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
    maxConcurrency: 5,
  },
});
```

- [ ] **Step 6: Create placeholder dirs**

Create empty files `packages/.gitkeep` and `apps/.gitkeep`.

- [ ] **Step 7: Install and verify**

Run: `pnpm install`
Expected: lockfile created, no errors.
Run: `pnpm test`
Expected: "No test files found" (exit 0) - the harness runs.

- [ ] **Step 8: Commit**

```bash
git add pnpm-workspace.yaml package.json turbo.json tsconfig.base.json vitest.config.ts packages/.gitkeep apps/.gitkeep pnpm-lock.yaml
git commit -m "CHORE: scaffold pnpm + turborepo monorepo"
```

---

### Task 2: `protocol` package - message schemas

**Files:**
- Create: `packages/protocol/package.json`
- Create: `packages/protocol/tsconfig.json`
- Create: `packages/protocol/src/messages.ts`
- Create: `packages/protocol/src/index.ts`
- Test: `packages/protocol/src/messages.test.ts`

**Interfaces:**
- Produces: Zod schemas + inferred types `Player`, `ClientMessage`, `ServerMessage`; `parseClientMessage(raw: string): ClientMessage` and `parseServerMessage(raw: string): ServerMessage` (throw `ZodError` on bad input). Message discriminator field is `t`.

- [ ] **Step 1: Create `packages/protocol/package.json`**

```json
{
  "name": "@hubbub/protocol",
  "version": "0.0.0",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": { "typecheck": "tsc --noEmit" },
  "dependencies": { "zod": "^3.23.0" },
  "devDependencies": { "typescript": "^5.5.0" }
}
```

- [ ] **Step 2: Create `packages/protocol/tsconfig.json`**

```json
{ "extends": "../../tsconfig.base.json", "include": ["src"] }
```

- [ ] **Step 3: Write the failing test** in `packages/protocol/src/messages.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { parseClientMessage, parseServerMessage } from "./messages.js";

describe("protocol messages", () => {
  it("parses a valid joinRoom client message", () => {
    const msg = parseClientMessage(
      JSON.stringify({ t: "joinRoom", code: "ABCD", name: "Joe" })
    );
    expect(msg).toEqual({ t: "joinRoom", code: "ABCD", name: "Joe" });
  });

  it("rejects an unknown message type", () => {
    expect(() => parseClientMessage(JSON.stringify({ t: "nope" }))).toThrow();
  });

  it("rejects joinRoom with a missing name", () => {
    expect(() =>
      parseClientMessage(JSON.stringify({ t: "joinRoom", code: "ABCD" }))
    ).toThrow();
  });

  it("parses a roomState server message with players", () => {
    const msg = parseServerMessage(
      JSON.stringify({
        t: "roomState",
        players: [{ id: "p1", name: "Joe", connected: true }],
      })
    );
    expect(msg).toEqual({
      t: "roomState",
      players: [{ id: "p1", name: "Joe", connected: true }],
    });
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `pnpm vitest run packages/protocol`
Expected: FAIL (cannot resolve `./messages.js`).

- [ ] **Step 5: Implement `packages/protocol/src/messages.ts`**

```ts
import { z } from "zod";

export const PlayerSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(24),
  connected: z.boolean(),
});
export type Player = z.infer<typeof PlayerSchema>;

// Client -> Server
export const ClientMessageSchema = z.discriminatedUnion("t", [
  z.object({ t: z.literal("createRoom") }),
  z.object({
    t: z.literal("joinRoom"),
    code: z.string().length(4),
    name: z.string().min(1).max(24),
    token: z.string().optional(),
  }),
]);
export type ClientMessage = z.infer<typeof ClientMessageSchema>;

// Server -> Client
export const ServerMessageSchema = z.discriminatedUnion("t", [
  z.object({ t: z.literal("roomCreated"), code: z.string().length(4) }),
  z.object({ t: z.literal("joined"), playerId: z.string(), token: z.string() }),
  z.object({ t: z.literal("roomState"), players: z.array(PlayerSchema) }),
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

- [ ] **Step 6: Create `packages/protocol/src/index.ts`**

```ts
export * from "./messages.js";
export * from "./transport.js";
export * from "./tokens.js";
```

> Note: `transport.js` and `tokens.js` are created in Tasks 3-4. If running tasks out of order, comment the not-yet-created exports until those tasks land.

- [ ] **Step 7: Run test to verify it passes**

Run: `pnpm vitest run packages/protocol`
Expected: PASS (4 tests). Temporarily reduce `index.ts` to only `export * from "./messages.js";` if Tasks 3-4 are not done yet.

- [ ] **Step 8: Commit**

```bash
git add packages/protocol/package.json packages/protocol/tsconfig.json packages/protocol/src/messages.ts packages/protocol/src/messages.test.ts packages/protocol/src/index.ts pnpm-lock.yaml
git commit -m "FEAT: add protocol message schemas"
```

---

### Task 3: `protocol` package - reconnect tokens

**Files:**
- Create: `packages/protocol/src/tokens.ts`
- Test: `packages/protocol/src/tokens.test.ts`

**Interfaces:**
- Produces: `newToken(): string` (URL-safe, >= 16 chars), `newRoomCode(): string` (4 chars from the unambiguous alphabet `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`).

- [ ] **Step 1: Write the failing test** in `packages/protocol/src/tokens.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { newToken, newRoomCode } from "./tokens.js";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

describe("tokens", () => {
  it("newToken returns a long unique string", () => {
    const a = newToken();
    const b = newToken();
    expect(a.length).toBeGreaterThanOrEqual(16);
    expect(a).not.toEqual(b);
  });

  it("newRoomCode returns 4 chars from the unambiguous alphabet", () => {
    for (let i = 0; i < 50; i++) {
      const code = newRoomCode();
      expect(code).toHaveLength(4);
      for (const ch of code) expect(CODE_ALPHABET).toContain(ch);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/protocol/src/tokens.test.ts`
Expected: FAIL (cannot resolve `./tokens.js`).

- [ ] **Step 3: Implement `packages/protocol/src/tokens.ts`**

```ts
import { randomUUID, randomInt } from "node:crypto";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function newToken(): string {
  return randomUUID().replace(/-/g, "");
}

export function newRoomCode(): string {
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return code;
}
```

> Note: `node:crypto` is fine here - tokens/codes are generated server-side. The browser apps never import `tokens.ts`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run packages/protocol/src/tokens.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/protocol/src/tokens.ts packages/protocol/src/tokens.test.ts
git commit -m "FEAT: add reconnect-token and room-code generators"
```

---

### Task 4: `protocol` package - ClientTransport interface + WebSocket impl

**Files:**
- Create: `packages/protocol/src/transport.ts`
- Test: `packages/protocol/src/transport.test.ts`

**Interfaces:**
- Produces: `interface ClientTransport` and `class WebSocketClientTransport implements ClientTransport`.

```ts
export interface ClientTransport {
  connect(): Promise<void>;
  send(msg: ClientMessage): void;
  onMessage(handler: (msg: ServerMessage) => void): () => void; // returns unsubscribe
  onClose(handler: () => void): () => void;
  close(): void;
}
```

- [ ] **Step 1: Write the failing test** in `packages/protocol/src/transport.test.ts`

```ts
import { describe, it, expect, afterEach } from "vitest";
import { WebSocketServer } from "ws";
import { WebSocketClientTransport } from "./transport.js";

let wss: WebSocketServer | undefined;
afterEach(() => wss?.close());

describe("WebSocketClientTransport", () => {
  it("connects, sends a typed message, and receives a typed reply", async () => {
    wss = new WebSocketServer({ port: 0 });
    await new Promise((r) => wss!.on("listening", r));
    const { port } = wss.address() as { port: number };

    wss.on("connection", (ws) => {
      ws.on("message", (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.t === "createRoom") {
          ws.send(JSON.stringify({ t: "roomCreated", code: "ABCD" }));
        }
      });
    });

    const t = new WebSocketClientTransport(`ws://localhost:${port}`);
    await t.connect();
    const got = await new Promise((resolve) => {
      t.onMessage(resolve);
      t.send({ t: "createRoom" });
    });
    expect(got).toEqual({ t: "roomCreated", code: "ABCD" });
    t.close();
  });
});
```

- [ ] **Step 2: Add `ws` dep**

Per the global Packages rule, run a typosquat + advisory check on `ws` first (it is the canonical, widely-used WebSocket lib; confirm latest patched version). Then:
Run: `pnpm --filter @hubbub/protocol add ws` and `pnpm --filter @hubbub/protocol add -D @types/ws`

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm vitest run packages/protocol/src/transport.test.ts`
Expected: FAIL (cannot resolve `./transport.js`).

- [ ] **Step 4: Implement `packages/protocol/src/transport.ts`**

```ts
import { WebSocket } from "ws";
import {
  parseServerMessage,
  type ClientMessage,
  type ServerMessage,
} from "./messages.js";

// Use the ws WebSocket in Node; browsers provide a compatible global WebSocket.
const WS: typeof WebSocket =
  typeof globalThis.WebSocket !== "undefined"
    ? (globalThis.WebSocket as unknown as typeof WebSocket)
    : WebSocket;

export interface ClientTransport {
  connect(): Promise<void>;
  send(msg: ClientMessage): void;
  onMessage(handler: (msg: ServerMessage) => void): () => void;
  onClose(handler: () => void): () => void;
  close(): void;
}

export class WebSocketClientTransport implements ClientTransport {
  private ws?: WebSocket;
  private messageHandlers = new Set<(msg: ServerMessage) => void>();
  private closeHandlers = new Set<() => void>();

  constructor(private url: string) {}

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WS(this.url);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (e: unknown) => reject(e);
      this.ws.onclose = () => this.closeHandlers.forEach((h) => h());
      this.ws.onmessage = (ev: { data: unknown }) => {
        const msg = parseServerMessage(String(ev.data));
        this.messageHandlers.forEach((h) => h(msg));
      };
    });
  }

  send(msg: ClientMessage): void {
    this.ws?.send(JSON.stringify(msg));
  }

  onMessage(handler: (msg: ServerMessage) => void): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  onClose(handler: () => void): () => void {
    this.closeHandlers.add(handler);
    return () => this.closeHandlers.delete(handler);
  }

  close(): void {
    this.ws?.close();
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run packages/protocol/src/transport.test.ts`
Expected: PASS (1 test).

- [ ] **Step 6: Commit**

```bash
git add packages/protocol/src/transport.ts packages/protocol/src/transport.test.ts packages/protocol/package.json pnpm-lock.yaml
git commit -m "FEAT: add ClientTransport interface and WebSocket implementation"
```

---

### Task 5: `server` package - RoomManager

**Files:**
- Create: `apps/server/package.json`
- Create: `apps/server/tsconfig.json`
- Create: `apps/server/src/rooms.ts`
- Test: `apps/server/src/rooms.test.ts`

**Interfaces:**
- Consumes: `Player`, `newToken`, `newRoomCode` from `@hubbub/protocol`.
- Produces:

```ts
interface JoinOk { ok: true; playerId: string; token: string }
interface JoinErr { ok: false; code: "no_room"; message: string }
class RoomManager {
  createRoom(): string;                         // returns room code
  hasRoom(code: string): boolean;
  join(code: string, name: string, token?: string): JoinOk | JoinErr;
  setConnected(code: string, playerId: string, connected: boolean): void;
  players(code: string): Player[];
}
```

- [ ] **Step 1: Create `apps/server/package.json`**

```json
{
  "name": "@hubbub/server",
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": { "@hubbub/protocol": "workspace:*", "ws": "^8.18.0" },
  "devDependencies": { "@types/ws": "^8.5.0", "tsx": "^4.16.0", "typescript": "^5.5.0" }
}
```

- [ ] **Step 2: Create `apps/server/tsconfig.json`**

```json
{ "extends": "../../tsconfig.base.json", "include": ["src"], "compilerOptions": { "outDir": "dist" } }
```

- [ ] **Step 3: Write the failing test** in `apps/server/src/rooms.test.ts`

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { RoomManager } from "./rooms.js";

let rm: RoomManager;
beforeEach(() => (rm = new RoomManager()));

describe("RoomManager", () => {
  it("creates a retrievable room", () => {
    const code = rm.createRoom();
    expect(code).toHaveLength(4);
    expect(rm.hasRoom(code)).toBe(true);
  });

  it("adds a player and lists them", () => {
    const code = rm.createRoom();
    const r = rm.join(code, "Joe");
    expect(r.ok).toBe(true);
    expect(rm.players(code)).toEqual([
      { id: (r as any).playerId, name: "Joe", connected: true },
    ]);
  });

  it("reclaims the same player id when rejoining with a token", () => {
    const code = rm.createRoom();
    const first = rm.join(code, "Joe");
    expect(first.ok).toBe(true);
    const token = (first as any).token;
    rm.setConnected(code, (first as any).playerId, false);
    const again = rm.join(code, "Joe", token);
    expect(again.ok).toBe(true);
    expect((again as any).playerId).toEqual((first as any).playerId);
    expect(rm.players(code)).toHaveLength(1);
    expect(rm.players(code)[0].connected).toBe(true);
  });

  it("errors when joining a missing room", () => {
    const r = rm.join("ZZZZ", "Joe");
    expect(r).toEqual({ ok: false, code: "no_room", message: expect.any(String) });
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `pnpm vitest run apps/server/src/rooms.test.ts`
Expected: FAIL (cannot resolve `./rooms.js`).

- [ ] **Step 5: Implement `apps/server/src/rooms.ts`**

```ts
import { newRoomCode, newToken, type Player } from "@hubbub/protocol";

interface StoredPlayer extends Player {
  token: string;
}
interface Room {
  code: string;
  players: Map<string, StoredPlayer>;
}

export interface JoinOk {
  ok: true;
  playerId: string;
  token: string;
}
export interface JoinErr {
  ok: false;
  code: "no_room";
  message: string;
}

export class RoomManager {
  private rooms = new Map<string, Room>();

  createRoom(): string {
    let code = newRoomCode();
    while (this.rooms.has(code)) code = newRoomCode();
    this.rooms.set(code, { code, players: new Map() });
    return code;
  }

  hasRoom(code: string): boolean {
    return this.rooms.has(code);
  }

  join(code: string, name: string, token?: string): JoinOk | JoinErr {
    const room = this.rooms.get(code);
    if (!room) return { ok: false, code: "no_room", message: "Room not found" };

    if (token) {
      for (const p of room.players.values()) {
        if (p.token === token) {
          p.name = name;
          p.connected = true;
          return { ok: true, playerId: p.id, token: p.token };
        }
      }
    }

    const id = newToken();
    const newTok = newToken();
    room.players.set(id, { id, name, connected: true, token: newTok });
    return { ok: true, playerId: id, token: newTok };
  }

  setConnected(code: string, playerId: string, connected: boolean): void {
    const p = this.rooms.get(code)?.players.get(playerId);
    if (p) p.connected = connected;
  }

  players(code: string): Player[] {
    const room = this.rooms.get(code);
    if (!room) return [];
    return [...room.players.values()].map(({ token, ...pub }) => pub);
  }
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm vitest run apps/server/src/rooms.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 7: Commit**

```bash
git add apps/server/package.json apps/server/tsconfig.json apps/server/src/rooms.ts apps/server/src/rooms.test.ts pnpm-lock.yaml
git commit -m "FEAT: add server RoomManager with reconnect-by-token"
```

---

### Task 6: `server` package - WebSocket server wiring

**Files:**
- Create: `apps/server/src/server.ts`
- Create: `apps/server/src/index.ts`
- Test: `apps/server/src/server.test.ts`

**Interfaces:**
- Consumes: `RoomManager`; `parseClientMessage`, `ServerMessage` from `@hubbub/protocol`.
- Produces: `createServer(port: number): { wss: WebSocketServer; close(): Promise<void> }`. Routing: a `screen` connection sends `createRoom` and gets `roomCreated`; a `controller` connection sends `joinRoom` and gets `joined` then everyone in the room gets `roomState`.

- [ ] **Step 1: Write the failing test** in `apps/server/src/server.test.ts`

```ts
import { describe, it, expect, afterEach } from "vitest";
import { WebSocket } from "ws";
import { createServer } from "./server.js";

let handle: Awaited<ReturnType<typeof createServer>> | undefined;
afterEach(async () => await handle?.close());

function open(port: number) {
  const ws = new WebSocket(`ws://localhost:${port}`);
  return new Promise<WebSocket>((res) => ws.on("open", () => res(ws)));
}
function next(ws: WebSocket) {
  return new Promise<any>((res) => ws.once("message", (m) => res(JSON.parse(m.toString()))));
}

describe("createServer", () => {
  it("creates a room then a controller joins and screen sees the player", async () => {
    handle = createServer(0);
    const port = (handle.wss.address() as { port: number }).port;

    const screen = await open(port);
    screen.send(JSON.stringify({ t: "createRoom" }));
    const created = await next(screen);
    expect(created.t).toBe("roomCreated");

    const controller = await open(port);
    controller.send(JSON.stringify({ t: "joinRoom", code: created.code, name: "Joe" }));
    const joined = await next(controller);
    expect(joined.t).toBe("joined");

    const state = await next(screen);
    expect(state.t).toBe("roomState");
    expect(state.players).toEqual([
      { id: joined.playerId, name: "Joe", connected: true },
    ]);

    screen.close();
    controller.close();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run apps/server/src/server.test.ts`
Expected: FAIL (cannot resolve `./server.js`).

- [ ] **Step 3: Implement `apps/server/src/server.ts`**

```ts
import { WebSocketServer, type WebSocket } from "ws";
import { parseClientMessage, type ServerMessage } from "@hubbub/protocol";
import { RoomManager } from "./rooms.js";

interface ConnState {
  roomCode?: string;
  playerId?: string;
  role?: "screen" | "controller";
}

export function createServer(port: number) {
  const wss = new WebSocketServer({ port });
  const rooms = new RoomManager();
  // code -> set of sockets (screen + controllers) for broadcast
  const sockets = new Map<string, Set<WebSocket>>();
  const state = new WeakMap<WebSocket, ConnState>();

  function send(ws: WebSocket, msg: ServerMessage) {
    ws.send(JSON.stringify(msg));
  }
  function broadcastRoomState(code: string) {
    const players = rooms.players(code);
    const msg: ServerMessage = { t: "roomState", players };
    sockets.get(code)?.forEach((ws) => send(ws, msg));
  }

  wss.on("connection", (ws) => {
    state.set(ws, {});
    ws.on("message", (raw) => {
      let msg;
      try {
        msg = parseClientMessage(raw.toString());
      } catch {
        send(ws, { t: "error", code: "bad_message", message: "Invalid message" });
        return;
      }
      const cs = state.get(ws)!;

      if (msg.t === "createRoom") {
        const code = rooms.createRoom();
        cs.role = "screen";
        cs.roomCode = code;
        sockets.set(code, new Set([ws]));
        send(ws, { t: "roomCreated", code });
        return;
      }

      if (msg.t === "joinRoom") {
        const result = rooms.join(msg.code, msg.name, msg.token);
        if (!result.ok) {
          send(ws, { t: "error", code: result.code, message: result.message });
          return;
        }
        cs.role = "controller";
        cs.roomCode = msg.code;
        cs.playerId = result.playerId;
        sockets.get(msg.code)?.add(ws);
        send(ws, { t: "joined", playerId: result.playerId, token: result.token });
        broadcastRoomState(msg.code);
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
    close: () =>
      new Promise<void>((resolve) => {
        wss.clients.forEach((c) => c.terminate());
        wss.close(() => resolve());
      }),
  };
}
```

- [ ] **Step 4: Create `apps/server/src/index.ts`**

```ts
import { createServer } from "./server.js";

const port = Number(process.env.PORT ?? 8787);
createServer(port);
console.log(`Hubbub server listening on ws://0.0.0.0:${port}`);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run apps/server/src/server.test.ts`
Expected: PASS (1 test).

- [ ] **Step 6: Run the full suite to confirm clean exit**

Run: `pnpm test`
Expected: all tests PASS and the process exits (no orphan, thanks to singleFork). If anything lingers, check for an unclosed `WebSocketServer` in a test.

- [ ] **Step 7: Commit**

```bash
git add apps/server/src/server.ts apps/server/src/index.ts apps/server/src/server.test.ts
git commit -m "FEAT: add WebSocket room server with create/join/broadcast"
```

---

### Task 7: `screen` app - create room, show code + QR + live players

**Files:**
- Create: `apps/screen/package.json`
- Create: `apps/screen/tsconfig.json`
- Create: `apps/screen/vite.config.ts`
- Create: `apps/screen/index.html`
- Create: `apps/screen/src/main.tsx`
- Create: `apps/screen/src/App.tsx`
- Create: `apps/screen/src/config.ts`

**Interfaces:**
- Consumes: `WebSocketClientTransport`, `ServerMessage`, `Player` from `@hubbub/protocol`.
- Produces: a screen that on load sends `createRoom`, renders the room code, a join QR/URL, and a live player list driven by `roomState`.

- [ ] **Step 1: Create `apps/screen/package.json`**

```json
{
  "name": "@hubbub/screen",
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@hubbub/protocol": "workspace:*",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "qrcode": "^1.5.3"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@types/qrcode": "^1.5.5",
    "@vitejs/plugin-react": "^4.3.0",
    "typescript": "^5.5.0",
    "vite": "^5.4.0"
  }
}
```

> Before adding, run the typosquat + advisory check on `qrcode` (canonical QR lib). It is bundled into the app (no CDN) per the offline-LAN rule.

- [ ] **Step 2: Create `apps/screen/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src"],
  "compilerOptions": { "jsx": "react-jsx", "lib": ["ES2022", "DOM", "DOM.Iterable"] }
}
```

- [ ] **Step 3: Create `apps/screen/vite.config.ts`**

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { host: true, port: 5173 }, // host:true exposes on LAN
});
```

- [ ] **Step 4: Create `apps/screen/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Hubbub - Screen</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Create `apps/screen/src/config.ts`**

```ts
// One flag flips local vs cloud. In dev, point at the local server.
export const SERVER_URL =
  import.meta.env.VITE_SERVER_URL ?? `ws://${location.hostname}:8787`;

// The controller app's base URL (where phones join). LAN IP in local mode.
export const CONTROLLER_URL =
  import.meta.env.VITE_CONTROLLER_URL ?? `http://${location.hostname}:5174`;
```

- [ ] **Step 6: Create `apps/screen/src/main.tsx`**

```tsx
import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";

createRoot(document.getElementById("root")!).render(<App />);
```

- [ ] **Step 7: Create `apps/screen/src/App.tsx`**

```tsx
import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import {
  WebSocketClientTransport,
  type Player,
} from "@hubbub/protocol";
import { SERVER_URL, CONTROLLER_URL } from "./config.js";

export function App() {
  const [code, setCode] = useState<string>("");
  const [players, setPlayers] = useState<Player[]>([]);
  const [qr, setQr] = useState<string>("");
  const transportRef = useRef<WebSocketClientTransport>();

  useEffect(() => {
    const t = new WebSocketClientTransport(SERVER_URL);
    transportRef.current = t;
    let off = () => {};
    t.connect().then(() => {
      off = t.onMessage((msg) => {
        if (msg.t === "roomCreated") {
          setCode(msg.code);
          const joinUrl = `${CONTROLLER_URL}/?room=${msg.code}`;
          QRCode.toDataURL(joinUrl).then(setQr);
        } else if (msg.t === "roomState") {
          setPlayers(msg.players);
        }
      });
      t.send({ t: "createRoom" });
    });
    return () => {
      off();
      t.close();
    };
  }, []);

  return (
    <main style={{ fontFamily: "system-ui", textAlign: "center", padding: 32 }}>
      <h1>Hubbub</h1>
      <p>Join at <strong>{CONTROLLER_URL.replace(/^https?:\/\//, "")}</strong></p>
      <h2 style={{ fontSize: 64, letterSpacing: 8 }}>{code || "…"}</h2>
      {qr && <img src={qr} alt="Join QR" width={220} height={220} />}
      <h3>Players ({players.length})</h3>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {players.map((p) => (
          <li key={p.id} style={{ opacity: p.connected ? 1 : 0.4 }}>
            {p.name}
          </li>
        ))}
      </ul>
    </main>
  );
}
```

- [ ] **Step 8: Typecheck**

Run: `pnpm --filter @hubbub/screen typecheck`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add apps/screen pnpm-lock.yaml
git commit -m "FEAT: add screen app with room code, QR, and live player list"
```

---

### Task 8: `controller` app - join by code, send name

**Files:**
- Create: `apps/controller/package.json`
- Create: `apps/controller/tsconfig.json`
- Create: `apps/controller/vite.config.ts`
- Create: `apps/controller/index.html`
- Create: `apps/controller/src/main.tsx`
- Create: `apps/controller/src/App.tsx`
- Create: `apps/controller/src/config.ts`

**Interfaces:**
- Consumes: `WebSocketClientTransport`, `ServerMessage` from `@hubbub/protocol`.
- Produces: a phone page that reads `?room=CODE`, takes a name, sends `joinRoom`, stores the reconnect token in `localStorage`, and shows "You're in".

- [ ] **Step 1: Create `apps/controller/package.json`**

```json
{
  "name": "@hubbub/controller",
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite --port 5174",
    "build": "vite build",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@hubbub/protocol": "workspace:*",
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "typescript": "^5.5.0",
    "vite": "^5.4.0"
  }
}
```

- [ ] **Step 2: Create `apps/controller/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src"],
  "compilerOptions": { "jsx": "react-jsx", "lib": ["ES2022", "DOM", "DOM.Iterable"] }
}
```

- [ ] **Step 3: Create `apps/controller/vite.config.ts`**

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { host: true, port: 5174 },
});
```

- [ ] **Step 4: Create `apps/controller/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <title>Hubbub - Controller</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Create `apps/controller/src/config.ts`**

```ts
export const SERVER_URL =
  import.meta.env.VITE_SERVER_URL ?? `ws://${location.hostname}:8787`;
```

- [ ] **Step 6: Create `apps/controller/src/main.tsx`**

```tsx
import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";

createRoot(document.getElementById("root")!).render(<App />);
```

- [ ] **Step 7: Create `apps/controller/src/App.tsx`**

```tsx
import { useRef, useState } from "react";
import { WebSocketClientTransport } from "@hubbub/protocol";
import { SERVER_URL } from "./config.js";

const roomFromUrl = new URLSearchParams(location.search).get("room") ?? "";

export function App() {
  const [code, setCode] = useState(roomFromUrl.toUpperCase());
  const [name, setName] = useState("");
  const [status, setStatus] = useState<"idle" | "joining" | "in" | "error">("idle");
  const [error, setError] = useState("");
  const transportRef = useRef<WebSocketClientTransport>();

  async function join() {
    setStatus("joining");
    const t = new WebSocketClientTransport(SERVER_URL);
    transportRef.current = t;
    await t.connect();
    t.onMessage((msg) => {
      if (msg.t === "joined") {
        localStorage.setItem(`hubbub:token:${code}`, msg.token);
        setStatus("in");
      } else if (msg.t === "error") {
        setError(msg.message);
        setStatus("error");
      }
    });
    const token = localStorage.getItem(`hubbub:token:${code}`) ?? undefined;
    t.send({ t: "joinRoom", code, name, token });
  }

  if (status === "in") {
    return (
      <main style={ui}>
        <h1>You're in!</h1>
        <p>Look at the big screen.</p>
      </main>
    );
  }

  return (
    <main style={ui}>
      <h1>Hubbub</h1>
      <input
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="ROOM"
        maxLength={4}
        style={input}
      />
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Your name"
        maxLength={24}
        style={input}
      />
      <button
        disabled={code.length !== 4 || name.trim() === "" || status === "joining"}
        onClick={join}
        style={button}
      >
        {status === "joining" ? "Joining…" : "Join"}
      </button>
      {status === "error" && <p style={{ color: "crimson" }}>{error}</p>}
    </main>
  );
}

const ui: React.CSSProperties = {
  fontFamily: "system-ui",
  display: "flex",
  flexDirection: "column",
  gap: 16,
  padding: 24,
  maxWidth: 360,
  margin: "0 auto",
};
const input: React.CSSProperties = { fontSize: 24, padding: 12, textAlign: "center" };
const button: React.CSSProperties = { fontSize: 24, padding: 12 };
```

- [ ] **Step 8: Typecheck**

Run: `pnpm --filter @hubbub/controller typecheck`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add apps/controller pnpm-lock.yaml
git commit -m "FEAT: add controller app with join-by-code and token persistence"
```

---

### Task 9: End-to-end manual verification + dev script

**Files:**
- Modify: `package.json` (root) - add a `dev:all` convenience script.

**Interfaces:**
- Consumes: all prior tasks.
- Produces: a documented manual run that proves the Phase 0 deliverable.

- [ ] **Step 1: Add a root `dev:all` script**

In root `package.json` scripts, add:

```json
"dev:all": "turbo run dev --concurrency=5 --filter=@hubbub/server --filter=@hubbub/screen --filter=@hubbub/controller"
```

- [ ] **Step 2: Run the stack via the supervised-run flow**

Start the three dev servers through `/supervised-run` (per the global process-hygiene rule), running `pnpm dev:all`. Confirm: server on `:8787`, screen on `:5173`, controller on `:5174`.

- [ ] **Step 3: Manual verification (the Phase 0 success criteria)**

1. Open `http://localhost:5173` (screen). A 4-letter code + QR appear.
2. On a phone on the same WiFi, open `http://<host-LAN-ip>:5174/?room=<CODE>` (or scan the QR). Enter a name, tap Join.
3. The name appears in the screen's player list within ~1s.
4. Kill the phone's tab and reopen the same URL: the player shows greyed out (disconnected) then reconnects to the same slot (token reclaim).

Record pass/fail for each. If any fail, debug before committing.

- [ ] **Step 4: Run the full automated suite**

Run: `pnpm typecheck` then `pnpm test`
Expected: both PASS, process exits cleanly (no orphan node processes - verify with the process-hygiene check).

- [ ] **Step 5: Commit**

```bash
git add package.json
git commit -m "CHORE: add dev:all script and document Phase 0 verification"
```

---

## Self-Review

**Spec coverage (Phase 0 scope):**
- Monorepo scaffolding → Task 1. ✓
- Protocol/transport interface (swappable) → Tasks 2, 4. ✓
- Zod schemas → Task 2. ✓
- Reconnect tokens → Task 3, used in Tasks 5/8. ✓
- Room create / code / join / player-list / broadcast → Tasks 5, 6. ✓
- Local/cloud config flag → `config.ts` in Tasks 7, 8 (`VITE_SERVER_URL`). ✓
- QR + LAN join URL → Task 7. ✓
- "Phone joins, name shows on screen" demoable → Task 9. ✓

**Deferred to later plans (correctly out of Phase 0 scope):** GameDefinition SDK, input widgets/actions, state sync beyond room membership, Electron host, real-time loop/WebRTC, cloud deploy, PWA manifest, wake-lock, room-code security hardening, Phosphor bundling (no icons used yet).

**Type consistency:** `ClientMessage`/`ServerMessage` discriminator `t` used identically across protocol, server, and both apps. `Player` shape `{id,name,connected}` consistent across protocol schema, RoomManager output, and both apps. `join()` returns `{ok,playerId,token}` consumed verbatim by Task 6.

**Placeholder scan:** none - every step has concrete code/commands.
