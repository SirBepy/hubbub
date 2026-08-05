# Phase 1 - Game SDK & First Game (Tic-Tac-Toe) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the `@hubbub/sdk` game contract + runtime and prove it end-to-end with a playable 3x3 Tic-Tac-Toe (server-authoritative, turn-based) running on the screen with phone controllers.

**Architecture:** A game implements three parts behind one contract: pure server `GameLogic` (state + reducers + Zod action schema), a screen view, and a controller view. The server owns authority: it holds a `GameInstance` per room, validates each incoming action against the game's schema, applies the reducer, and broadcasts the new state to the screen and all controllers. Views are React and live in game subpath exports so the Node server never imports React.

**Tech Stack:** TypeScript, Zod, React, the existing `@hubbub/protocol` transport. Server-authoritative (no `tickRateHz` yet - that's Phase 4).

## Global Constraints

- Node 20+; TypeScript strict; ESM; concurrency capped at 5.
- Game/SDK/app code depends only on the `ClientTransport` interface, never a concrete transport.
- Browser bundles stay Node-free: React views live in game subpaths (`/screen`, `/controller`); pure logic in the index.
- Server is authoritative for turn-based games; invalid moves are no-ops that return state unchanged.
- Default server port 7787 (8787 is taken on this machine).
- Stage changes per task; commit via the project `/commit` flow.

---

### Task 1: Protocol - game action + state messages

**Files:**
- Modify: `packages/protocol/src/messages.ts`
- Test: `packages/protocol/src/messages.test.ts` (add cases)

**Interfaces:**
- Produces: client message `{ t: "action", payload?: unknown }`; server message `{ t: "gameState", state: unknown }`. Payload/state are opaque at the protocol layer; the SDK + game validate specifics.

- [ ] **Step 1: Add failing tests** to `packages/protocol/src/messages.test.ts`

```ts
it("parses an action client message", () => {
  const msg = parseClientMessage(JSON.stringify({ t: "action", payload: { cell: 4 } }));
  expect(msg).toEqual({ t: "action", payload: { cell: 4 } });
});

it("parses a gameState server message", () => {
  const msg = parseServerMessage(JSON.stringify({ t: "gameState", state: { foo: 1 } }));
  expect(msg).toEqual({ t: "gameState", state: { foo: 1 } });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm vitest run packages/protocol/src/messages.test.ts`
Expected: FAIL (action/gameState not in unions).

- [ ] **Step 3: Extend the schemas** in `packages/protocol/src/messages.ts`

Add to `ClientMessageSchema` union:
```ts
z.object({ t: z.literal("action"), payload: z.unknown().optional() }),
```
Add to `ServerMessageSchema` union:
```ts
z.object({ t: z.literal("gameState"), state: z.unknown() }),
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm vitest run packages/protocol/src/messages.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/protocol/src/messages.ts packages/protocol/src/messages.test.ts
git commit -m "FEAT: add action and gameState protocol messages"
```

---

### Task 2: SDK core - GameLogic contract + GameInstance runtime

**Files:**
- Create: `packages/sdk/package.json`
- Create: `packages/sdk/tsconfig.json`
- Create: `packages/sdk/src/types.ts`
- Create: `packages/sdk/src/runtime.ts`
- Create: `packages/sdk/src/index.ts`
- Test: `packages/sdk/src/runtime.test.ts`

**Interfaces:**
- Produces:
```ts
interface PlayerInfo { id: string; name: string }
interface GameMeta { name: string; minPlayers: number; maxPlayers?: number }
interface GameLogic<State, Action> {
  meta: GameMeta;
  actionSchema: ZodType<Action>;
  init(players: PlayerInfo[]): State;
  onAction(state: State, playerId: string, action: Action): State;
  onPlayersChanged(state: State, players: PlayerInfo[]): State;
}
class GameInstance<State, Action> {
  constructor(logic: GameLogic<State, Action>, players: PlayerInfo[]);
  get(): State;
  playersChanged(players: PlayerInfo[]): void;
  applyAction(playerId: string, rawPayload: unknown): boolean; // false if schema-invalid
}
```

- [ ] **Step 1: Create `packages/sdk/package.json`**

```json
{
  "name": "@hubbub/sdk",
  "version": "0.0.0",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./react": "./src/react.tsx"
  },
  "scripts": { "typecheck": "tsc --noEmit" },
  "dependencies": { "@hubbub/protocol": "workspace:*", "zod": "^3.23.0" },
  "peerDependencies": { "react": "^18.3.0" },
  "peerDependenciesMeta": { "react": { "optional": true } },
  "devDependencies": {
    "typescript": "^5.5.0",
    "react": "^18.3.0",
    "@types/react": "^18.3.0"
  }
}
```

- [ ] **Step 2: Create `packages/sdk/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src"],
  "compilerOptions": { "jsx": "react-jsx", "lib": ["ES2022", "DOM"] }
}
```

- [ ] **Step 3: Create `packages/sdk/src/types.ts`**

```ts
import type { ZodType } from "zod";

export interface PlayerInfo {
  id: string;
  name: string;
}

export interface GameMeta {
  name: string;
  minPlayers: number;
  maxPlayers?: number;
}

export interface GameLogic<State, Action> {
  meta: GameMeta;
  actionSchema: ZodType<Action>;
  init(players: PlayerInfo[]): State;
  onAction(state: State, playerId: string, action: Action): State;
  onPlayersChanged(state: State, players: PlayerInfo[]): State;
}
```

- [ ] **Step 4: Write the failing test** in `packages/sdk/src/runtime.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { z } from "zod";
import { GameInstance } from "./runtime.js";
import type { GameLogic } from "./types.js";

// Minimal game: a shared counter only the first player may increment.
interface CounterState { count: number; owner: string | null }
interface CounterAction { by: number }

const counter: GameLogic<CounterState, CounterAction> = {
  meta: { name: "Counter", minPlayers: 1 },
  actionSchema: z.object({ by: z.number() }),
  init: (players) => ({ count: 0, owner: players[0]?.id ?? null }),
  onAction: (s, playerId, a) =>
    playerId === s.owner ? { ...s, count: s.count + a.by } : s,
  onPlayersChanged: (s, players) =>
    s.owner ? s : { ...s, owner: players[0]?.id ?? null },
};

describe("GameInstance", () => {
  it("initializes state from logic", () => {
    const gi = new GameInstance(counter, [{ id: "p1", name: "Joe" }]);
    expect(gi.get()).toEqual({ count: 0, owner: "p1" });
  });

  it("applies a schema-valid action from the owner", () => {
    const gi = new GameInstance(counter, [{ id: "p1", name: "Joe" }]);
    expect(gi.applyAction("p1", { by: 5 })).toBe(true);
    expect(gi.get().count).toBe(5);
  });

  it("rejects a schema-invalid payload without mutating state", () => {
    const gi = new GameInstance(counter, [{ id: "p1", name: "Joe" }]);
    expect(gi.applyAction("p1", { by: "lots" })).toBe(false);
    expect(gi.get().count).toBe(0);
  });

  it("lets the game no-op a rule-invalid action (non-owner)", () => {
    const gi = new GameInstance(counter, [{ id: "p1", name: "Joe" }]);
    expect(gi.applyAction("p2", { by: 5 })).toBe(true); // schema ok
    expect(gi.get().count).toBe(0); // logic ignored it
  });
});
```

- [ ] **Step 5: Run to verify it fails**

Run: `pnpm vitest run packages/sdk/src/runtime.test.ts`
Expected: FAIL (cannot resolve `./runtime.js`).

- [ ] **Step 6: Implement `packages/sdk/src/runtime.ts`**

```ts
import type { GameLogic, PlayerInfo } from "./types.js";

export class GameInstance<State, Action> {
  private state: State;

  constructor(
    private logic: GameLogic<State, Action>,
    players: PlayerInfo[]
  ) {
    this.state = logic.init(players);
  }

  get(): State {
    return this.state;
  }

  playersChanged(players: PlayerInfo[]): void {
    this.state = this.logic.onPlayersChanged(this.state, players);
  }

  applyAction(playerId: string, rawPayload: unknown): boolean {
    const parsed = this.logic.actionSchema.safeParse(rawPayload);
    if (!parsed.success) return false;
    this.state = this.logic.onAction(this.state, playerId, parsed.data);
    return true;
  }
}
```

- [ ] **Step 7: Create `packages/sdk/src/index.ts`**

```ts
export * from "./types.js";
export * from "./runtime.js";
```

- [ ] **Step 8: Run to verify pass**

Run: `pnpm install` then `pnpm vitest run packages/sdk/src/runtime.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 9: Commit**

```bash
git add packages/sdk/package.json packages/sdk/tsconfig.json packages/sdk/src/types.ts packages/sdk/src/runtime.ts packages/sdk/src/index.ts packages/sdk/src/runtime.test.ts pnpm-lock.yaml
git commit -m "FEAT: add SDK GameLogic contract and GameInstance runtime"
```

---

### Task 3: SDK react client helpers

**Files:**
- Create: `packages/sdk/src/react.tsx`

**Interfaces:**
- Consumes: `ClientTransport`, `ServerMessage` from `@hubbub/protocol`.
- Produces:
```ts
function useGameState<State>(transport: ClientTransport | null): State | null;
function createActionSender<Action>(transport: ClientTransport): (action: Action) => void;
```

- [ ] **Step 1: Implement `packages/sdk/src/react.tsx`**

```tsx
import { useEffect, useState } from "react";
import type { ClientTransport } from "@hubbub/protocol";

// Subscribes to gameState broadcasts and returns the latest state (or null).
export function useGameState<State>(transport: ClientTransport | null): State | null {
  const [state, setState] = useState<State | null>(null);
  useEffect(() => {
    if (!transport) return;
    return transport.onMessage((msg) => {
      if (msg.t === "gameState") setState(msg.state as State);
    });
  }, [transport]);
  return state;
}

// Returns a typed sender that wraps an action object in the protocol envelope.
export function createActionSender<Action>(
  transport: ClientTransport
): (action: Action) => void {
  return (action: Action) => transport.send({ t: "action", payload: action });
}
```

- [ ] **Step 2: Typecheck the SDK**

Run: `pnpm --filter @hubbub/sdk typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/sdk/src/react.tsx
git commit -m "FEAT: add SDK React helpers (useGameState, createActionSender)"
```

---

### Task 4: Server hosts a game per room

**Files:**
- Modify: `apps/server/src/server.ts`
- Modify: `apps/server/src/index.ts`
- Test: `apps/server/src/server.game.test.ts`

**Interfaces:**
- Consumes: `GameInstance`, `GameLogic`, `PlayerInfo` from `@hubbub/sdk`.
- Produces: `createServer(port: number, game?: GameLogic<any, any>)`. When `game` is provided: a `GameInstance` is created per room on `createRoom`, updated on join/leave via `playersChanged`, fed actions via `applyAction(playerId, payload)`, and `{ t: "gameState", state }` is broadcast to the whole room after every change.

- [ ] **Step 1: Write the failing test** in `apps/server/src/server.game.test.ts`

```ts
import { describe, it, expect, afterEach } from "vitest";
import { WebSocket } from "ws";
import { z } from "zod";
import type { GameLogic } from "@hubbub/sdk";
import { createServer } from "./server.js";

interface S { count: number; owner: string | null }
const game: GameLogic<S, { by: number }> = {
  meta: { name: "Counter", minPlayers: 1 },
  actionSchema: z.object({ by: z.number() }),
  init: (p) => ({ count: 0, owner: p[0]?.id ?? null }),
  onAction: (s, id, a) => (id === s.owner ? { ...s, count: s.count + a.by } : s),
  onPlayersChanged: (s, p) => (s.owner ? s : { ...s, owner: p[0]?.id ?? null }),
};

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
      if (msg.t === t) {
        ws.off("message", h);
        res(msg);
      }
    };
    ws.on("message", h);
  });

describe("createServer with a game", () => {
  it("broadcasts gameState on join and applies actions", async () => {
    handle = createServer(0, game);
    const port = (handle.wss.address() as { port: number }).port;

    const screen = await open(port);
    screen.send(JSON.stringify({ t: "createRoom" }));
    const created = await nextOf(screen, "roomCreated");

    const controller = await open(port);
    controller.send(JSON.stringify({ t: "joinRoom", code: created.code, name: "Joe" }));
    await nextOf(controller, "joined");

    const initial = await nextOf(screen, "gameState");
    expect(initial.state.count).toBe(0);

    controller.send(JSON.stringify({ t: "action", payload: { by: 3 } }));
    const after = await nextOf(screen, "gameState");
    expect(after.state.count).toBe(3);

    screen.close();
    controller.close();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run apps/server/src/server.game.test.ts`
Expected: FAIL (createServer ignores the game arg).

- [ ] **Step 3: Add `@hubbub/sdk` dependency to the server**

In `apps/server/package.json` dependencies add `"@hubbub/sdk": "workspace:*"`, then `pnpm install`.

- [ ] **Step 4: Modify `apps/server/src/server.ts`**

Add imports at top:
```ts
import { GameInstance, type GameLogic, type PlayerInfo } from "@hubbub/sdk";
```
Change the signature:
```ts
export function createServer(port: number, game?: GameLogic<any, any>) {
```
Add a per-room instance map near the other maps:
```ts
const games = new Map<string, GameInstance<any, any>>();
```
Add a helper near `broadcastRoomState`:
```ts
function toPlayerInfo(code: string): PlayerInfo[] {
  return rooms.players(code).map((p) => ({ id: p.id, name: p.name }));
}
function broadcastGameState(code: string) {
  const gi = games.get(code);
  if (!gi) return;
  const msg: ServerMessage = { t: "gameState", state: gi.get() };
  sockets.get(code)?.forEach((ws) => send(ws, msg));
}
```
In the `createRoom` branch, after `send(ws, { t: "roomCreated", code })` and before `return`:
```ts
if (game) games.set(code, new GameInstance(game, []));
```
In the `joinRoom` branch, after `broadcastRoomState(msg.code);` add:
```ts
const gi = games.get(msg.code);
if (gi) {
  gi.playersChanged(toPlayerInfo(msg.code));
  broadcastGameState(msg.code);
}
```
Add a new branch after `joinRoom` for actions:
```ts
if (msg.t === "action") {
  if (!cs.roomCode || !cs.playerId) return;
  const inst = games.get(cs.roomCode);
  if (!inst) return;
  inst.applyAction(cs.playerId, msg.payload);
  broadcastGameState(cs.roomCode);
  return;
}
```
In the `close` handler, after the existing controller-disconnect `broadcastRoomState`, also refresh the game roster:
```ts
const gi2 = games.get(cs.roomCode);
if (gi2) {
  gi2.playersChanged(toPlayerInfo(cs.roomCode));
  broadcastGameState(cs.roomCode);
}
```

- [ ] **Step 5: Wire the game in `apps/server/src/index.ts`**

```ts
import { createServer } from "./server.js";
import { tttLogic } from "@hubbub/game-tictactoe";

const port = Number(process.env.PORT ?? 7787);
createServer(port, tttLogic);
console.log(`Hubbub server listening on ws://0.0.0.0:${port}`);
```
> Note: `@hubbub/game-tictactoe` is created in Task 5. Until then, this import fails - keep `index.ts` on the Phase 0 version (no game arg) until Task 5 lands, or implement Task 5 before re-running the server. The test in Step 1 uses an inline game and does not need the package.

- [ ] **Step 6: Run to verify pass**

Run: `pnpm vitest run apps/server/src/server.game.test.ts`
Expected: PASS (1 test). Also run `pnpm vitest run apps/server/src/server.test.ts` (Phase 0, no game) - still PASS.

- [ ] **Step 7: Commit** (index.ts wiring is committed in Task 8 once the package exists)

```bash
git add apps/server/src/server.ts apps/server/src/server.game.test.ts apps/server/package.json pnpm-lock.yaml
git commit -m "FEAT: server hosts a per-room game and broadcasts gameState"
```

---

### Task 5: Tic-Tac-Toe game package

**Files:**
- Create: `packages/games/tictactoe/package.json`
- Create: `packages/games/tictactoe/tsconfig.json`
- Create: `packages/games/tictactoe/src/logic.ts`
- Create: `packages/games/tictactoe/src/index.ts`
- Create: `packages/games/tictactoe/src/screen.tsx`
- Create: `packages/games/tictactoe/src/controller.tsx`
- Test: `packages/games/tictactoe/src/logic.test.ts`

**Interfaces:**
- Produces (index, pure):
```ts
type Mark = "X" | "O";
type Cell = Mark | null;
interface TTTState { board: Cell[]; turn: Mark; assignments: Record<string, Mark>; winner: Mark | "draw" | null }
interface TTTAction { cell: number }
const actionSchema: ZodType<TTTAction>;
const tttLogic: GameLogic<TTTState, TTTAction>;
```
- Produces (`/screen`): `TTTScreen({ state }: { state: TTTState })`.
- Produces (`/controller`): `TTTController({ state, playerId, send }: { state: TTTState; playerId: string; send: (a: TTTAction) => void })`.

- [ ] **Step 1: Create `packages/games/tictactoe/package.json`**

```json
{
  "name": "@hubbub/game-tictactoe",
  "version": "0.0.0",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./screen": "./src/screen.tsx",
    "./controller": "./src/controller.tsx"
  },
  "scripts": { "typecheck": "tsc --noEmit" },
  "dependencies": { "@hubbub/sdk": "workspace:*", "zod": "^3.23.0" },
  "peerDependencies": { "react": "^18.3.0" },
  "peerDependenciesMeta": { "react": { "optional": true } },
  "devDependencies": {
    "typescript": "^5.5.0",
    "react": "^18.3.0",
    "@types/react": "^18.3.0"
  }
}
```

- [ ] **Step 2: Create `packages/games/tictactoe/tsconfig.json`**

```json
{
  "extends": "../../../tsconfig.base.json",
  "include": ["src"],
  "compilerOptions": { "jsx": "react-jsx", "lib": ["ES2022", "DOM"] }
}
```

- [ ] **Step 3: Write the failing test** in `packages/games/tictactoe/src/logic.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { tttLogic } from "./logic.js";
import type { TTTState } from "./logic.js";

const P = [
  { id: "a", name: "Ann" },
  { id: "b", name: "Bo" },
];
const fresh = (): TTTState => tttLogic.init(P);

describe("tic-tac-toe logic", () => {
  it("assigns X to the first player and O to the second, X starts", () => {
    const s = fresh();
    expect(s.assignments).toEqual({ a: "X", b: "O" });
    expect(s.turn).toBe("X");
    expect(s.board).toHaveLength(9);
    expect(s.winner).toBeNull();
  });

  it("applies a move and flips the turn", () => {
    const s = tttLogic.onAction(fresh(), "a", { cell: 0 });
    expect(s.board[0]).toBe("X");
    expect(s.turn).toBe("O");
  });

  it("ignores a move from the player whose turn it is not", () => {
    const s = tttLogic.onAction(fresh(), "b", { cell: 0 });
    expect(s.board[0]).toBeNull();
    expect(s.turn).toBe("X");
  });

  it("ignores a move on an occupied cell", () => {
    let s = tttLogic.onAction(fresh(), "a", { cell: 0 });
    s = tttLogic.onAction(s, "b", { cell: 0 });
    expect(s.board[0]).toBe("X");
    expect(s.turn).toBe("O");
  });

  it("ignores a move from a non-player (spectator)", () => {
    const s = tttLogic.onAction(fresh(), "zzz", { cell: 0 });
    expect(s.board[0]).toBeNull();
  });

  it("detects a row win", () => {
    let s = fresh();
    s = tttLogic.onAction(s, "a", { cell: 0 }); // X
    s = tttLogic.onAction(s, "b", { cell: 3 }); // O
    s = tttLogic.onAction(s, "a", { cell: 1 }); // X
    s = tttLogic.onAction(s, "b", { cell: 4 }); // O
    s = tttLogic.onAction(s, "a", { cell: 2 }); // X wins top row
    expect(s.winner).toBe("X");
  });

  it("stops accepting moves after a win", () => {
    let s = fresh();
    for (const [id, cell] of [["a", 0], ["b", 3], ["a", 1], ["b", 4], ["a", 2]] as const) {
      s = tttLogic.onAction(s, id, { cell });
    }
    const after = tttLogic.onAction(s, "b", { cell: 5 });
    expect(after.board[5]).toBeNull();
    expect(after.winner).toBe("X");
  });

  it("detects a draw", () => {
    // X O X / X O O / O X X  -> full board, no 3-in-a-row
    const order: Array<["a" | "b", number]> = [
      ["a", 0], ["b", 1], ["a", 2],
      ["b", 4], ["a", 3], ["b", 5],
      ["a", 7], ["b", 6], ["a", 8],
    ];
    let s = fresh();
    for (const [id, cell] of order) s = tttLogic.onAction(s, id, { cell });
    expect(s.winner).toBe("draw");
  });
});
```

- [ ] **Step 4: Run to verify it fails**

Run: `pnpm vitest run packages/games/tictactoe/src/logic.test.ts`
Expected: FAIL (cannot resolve `./logic.js`).

- [ ] **Step 5: Implement `packages/games/tictactoe/src/logic.ts`**

```ts
import { z } from "zod";
import type { GameLogic, PlayerInfo } from "@hubbub/sdk";

export type Mark = "X" | "O";
export type Cell = Mark | null;

export interface TTTState {
  board: Cell[];
  turn: Mark;
  assignments: Record<string, Mark>;
  winner: Mark | "draw" | null;
}

export interface TTTAction {
  cell: number;
}

export const actionSchema = z.object({
  cell: z.number().int().min(0).max(8),
});

const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

function winnerOf(board: Cell[]): Mark | "draw" | null {
  for (const [a, b, c] of LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a] as Mark;
    }
  }
  return board.every((c) => c !== null) ? "draw" : null;
}

function assign(players: PlayerInfo[]): Record<string, Mark> {
  const out: Record<string, Mark> = {};
  if (players[0]) out[players[0].id] = "X";
  if (players[1]) out[players[1].id] = "O";
  return out;
}

export const tttLogic: GameLogic<TTTState, TTTAction> = {
  meta: { name: "Tic-Tac-Toe", minPlayers: 2, maxPlayers: 2 },
  actionSchema,

  init: (players) => ({
    board: Array(9).fill(null),
    turn: "X",
    assignments: assign(players),
    winner: null,
  }),

  onPlayersChanged: (state, players) => {
    // Keep existing assignments; fill empty seats from the current roster.
    const assignments = { ...state.assignments };
    const taken = new Set(Object.values(assignments));
    for (const p of players) {
      if (assignments[p.id]) continue;
      if (!taken.has("X")) {
        assignments[p.id] = "X";
        taken.add("X");
      } else if (!taken.has("O")) {
        assignments[p.id] = "O";
        taken.add("O");
      }
    }
    return { ...state, assignments };
  },

  onAction: (state, playerId, action) => {
    if (state.winner) return state;
    const mark = state.assignments[playerId];
    if (!mark || mark !== state.turn) return state;
    if (state.board[action.cell] !== null) return state;

    const board = state.board.slice();
    board[action.cell] = mark;
    return {
      ...state,
      board,
      turn: mark === "X" ? "O" : "X",
      winner: winnerOf(board),
    };
  },
};
```

- [ ] **Step 6: Run to verify pass**

Run: `pnpm install` then `pnpm vitest run packages/games/tictactoe/src/logic.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 7: Create `packages/games/tictactoe/src/index.ts`**

```ts
export * from "./logic.js";
```

- [ ] **Step 8: Create `packages/games/tictactoe/src/screen.tsx`**

```tsx
import type { TTTState } from "./logic.js";

export function TTTScreen({ state }: { state: TTTState }) {
  const status =
    state.winner === "draw"
      ? "Draw!"
      : state.winner
        ? `${state.winner} wins!`
        : `${state.turn} to move`;

  return (
    <div style={{ textAlign: "center", fontFamily: "system-ui" }}>
      <h2>{status}</h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 96px)",
          gap: 6,
          justifyContent: "center",
        }}
      >
        {state.board.map((cell, i) => (
          <div
            key={i}
            style={{
              width: 96,
              height: 96,
              border: "2px solid #333",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 56,
            }}
          >
            {cell}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 9: Create `packages/games/tictactoe/src/controller.tsx`**

```tsx
import type { TTTState, TTTAction } from "./logic.js";

export function TTTController({
  state,
  playerId,
  send,
}: {
  state: TTTState;
  playerId: string;
  send: (a: TTTAction) => void;
}) {
  const mark = state.assignments[playerId];
  const yourTurn = !state.winner && mark === state.turn;
  const status = !mark
    ? "Spectating"
    : state.winner
      ? "Game over"
      : yourTurn
        ? "Your turn"
        : "Waiting…";

  return (
    <div style={{ textAlign: "center", fontFamily: "system-ui" }}>
      <p>
        You are <strong>{mark ?? "-"}</strong> · {status}
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 8,
          maxWidth: 300,
          margin: "0 auto",
        }}
      >
        {state.board.map((cell, i) => (
          <button
            key={i}
            disabled={!yourTurn || cell !== null}
            onClick={() => send({ cell: i })}
            style={{ aspectRatio: "1", fontSize: 36 }}
          >
            {cell}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 10: Typecheck the game package**

Run: `pnpm --filter @hubbub/game-tictactoe typecheck`
Expected: no errors.

- [ ] **Step 11: Commit**

```bash
git add packages/games/tictactoe pnpm-lock.yaml
git commit -m "FEAT: add Tic-Tac-Toe game (logic, screen, controller)"
```

---

### Task 6: Wire screen app to render the game

**Files:**
- Modify: `apps/screen/package.json` (add game dep)
- Modify: `apps/screen/src/App.tsx`

**Interfaces:**
- Consumes: `useGameState` from `@hubbub/sdk/react`; `TTTScreen` from `@hubbub/game-tictactoe/screen`; `TTTState` from `@hubbub/game-tictactoe`.

- [ ] **Step 1: Add deps** to `apps/screen/package.json` dependencies: `"@hubbub/sdk": "workspace:*"`, `"@hubbub/game-tictactoe": "workspace:*"`. Run `pnpm install`.

- [ ] **Step 2: Modify `apps/screen/src/App.tsx`** to keep the lobby until the game has state, then render the board. Replace the file body with:

```tsx
import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { WebSocketClientTransport, type Player } from "@hubbub/protocol";
import { useGameState } from "@hubbub/sdk/react";
import { TTTScreen } from "@hubbub/game-tictactoe/screen";
import type { TTTState } from "@hubbub/game-tictactoe";
import { SERVER_URL, CONTROLLER_URL } from "./config";

export function App() {
  const [code, setCode] = useState<string>("");
  const [players, setPlayers] = useState<Player[]>([]);
  const [qr, setQr] = useState<string>("");
  const [transport, setTransport] = useState<WebSocketClientTransport | null>(null);
  const transportRef = useRef<WebSocketClientTransport>();
  const game = useGameState<TTTState>(transport);

  useEffect(() => {
    const t = new WebSocketClientTransport(SERVER_URL);
    transportRef.current = t;
    let off = () => {};
    t.connect().then(() => {
      off = t.onMessage((msg) => {
        if (msg.t === "roomCreated") {
          setCode(msg.code);
          QRCode.toDataURL(`${CONTROLLER_URL}/?room=${msg.code}`).then(setQr);
        } else if (msg.t === "roomState") {
          setPlayers(msg.players);
        }
      });
      setTransport(t);
      t.send({ t: "createRoom" });
    });
    return () => {
      off();
      t.close();
    };
  }, []);

  const started = game && Object.keys(game.assignments).length >= 2;

  return (
    <main style={{ fontFamily: "system-ui", textAlign: "center", padding: 32 }}>
      <h1>Hubbub · Tic-Tac-Toe</h1>
      {started ? (
        <TTTScreen state={game} />
      ) : (
        <>
          <p>
            Join at <strong>{CONTROLLER_URL.replace(/^https?:\/\//, "")}</strong>
          </p>
          <h2 style={{ fontSize: 64, letterSpacing: 8 }}>{code || "…"}</h2>
          {qr && <img src={qr} alt="Join QR" width={220} height={220} />}
          <h3>Players ({players.length}/2)</h3>
          <ul style={{ listStyle: "none", padding: 0 }}>
            {players.map((p) => (
              <li key={p.id} style={{ opacity: p.connected ? 1 : 0.4 }}>
                {p.name}
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
```

- [ ] **Step 3: Typecheck + build the screen**

Run: `pnpm --filter @hubbub/screen typecheck` then `pnpm --filter @hubbub/screen build`
Expected: both succeed.

- [ ] **Step 4: Commit**

```bash
git add apps/screen/package.json apps/screen/src/App.tsx pnpm-lock.yaml
git commit -m "FEAT: render Tic-Tac-Toe board on the screen"
```

---

### Task 7: Wire controller app to play the game

**Files:**
- Modify: `apps/controller/package.json` (add deps)
- Modify: `apps/controller/src/App.tsx`

**Interfaces:**
- Consumes: `useGameState`, `createActionSender` from `@hubbub/sdk/react`; `TTTController` from `@hubbub/game-tictactoe/controller`; `TTTState`, `TTTAction` from `@hubbub/game-tictactoe`.

- [ ] **Step 1: Add deps** to `apps/controller/package.json` dependencies: `"@hubbub/sdk": "workspace:*"`, `"@hubbub/game-tictactoe": "workspace:*"`. Run `pnpm install`.

- [ ] **Step 2: Modify `apps/controller/src/App.tsx`** so that after joining it renders the controller view. Replace the file with:

```tsx
import { useRef, useState, type CSSProperties } from "react";
import { WebSocketClientTransport } from "@hubbub/protocol";
import { useGameState, createActionSender } from "@hubbub/sdk/react";
import { TTTController } from "@hubbub/game-tictactoe/controller";
import type { TTTState, TTTAction } from "@hubbub/game-tictactoe";
import { SERVER_URL } from "./config";

const roomFromUrl = new URLSearchParams(location.search).get("room") ?? "";

export function App() {
  const [code, setCode] = useState(roomFromUrl.toUpperCase());
  const [name, setName] = useState("");
  const [status, setStatus] = useState<"idle" | "joining" | "in" | "error">("idle");
  const [error, setError] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [transport, setTransport] = useState<WebSocketClientTransport | null>(null);
  const transportRef = useRef<WebSocketClientTransport>();
  const game = useGameState<TTTState>(transport);

  async function join() {
    setStatus("joining");
    const t = new WebSocketClientTransport(SERVER_URL);
    transportRef.current = t;
    await t.connect();
    t.onMessage((msg) => {
      if (msg.t === "joined") {
        localStorage.setItem(`hubbub:token:${code}`, msg.token);
        setPlayerId(msg.playerId);
        setStatus("in");
      } else if (msg.t === "error") {
        setError(msg.message);
        setStatus("error");
      }
    });
    setTransport(t);
    const token = localStorage.getItem(`hubbub:token:${code}`) ?? undefined;
    t.send({ t: "joinRoom", code, name, token });
  }

  if (status === "in") {
    return (
      <main style={ui}>
        {game ? (
          <TTTController
            state={game}
            playerId={playerId}
            send={createActionSender<TTTAction>(transportRef.current!)}
          />
        ) : (
          <p>Waiting for the game…</p>
        )}
      </main>
    );
  }

  return (
    <main style={ui}>
      <h1>Hubbub</h1>
      <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ROOM" maxLength={4} style={input} />
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" maxLength={24} style={input} />
      <button disabled={code.length !== 4 || name.trim() === "" || status === "joining"} onClick={join} style={button}>
        {status === "joining" ? "Joining…" : "Join"}
      </button>
      {status === "error" && <p style={{ color: "crimson" }}>{error}</p>}
    </main>
  );
}

const ui: CSSProperties = { fontFamily: "system-ui", display: "flex", flexDirection: "column", gap: 16, padding: 24, maxWidth: 360, margin: "0 auto" };
const input: CSSProperties = { fontSize: 24, padding: 12, textAlign: "center" };
const button: CSSProperties = { fontSize: 24, padding: 12 };
```

- [ ] **Step 3: Typecheck + build the controller**

Run: `pnpm --filter @hubbub/controller typecheck` then `pnpm --filter @hubbub/controller build`
Expected: both succeed.

- [ ] **Step 4: Commit**

```bash
git add apps/controller/package.json apps/controller/src/App.tsx pnpm-lock.yaml
git commit -m "FEAT: play Tic-Tac-Toe from the controller"
```

---

### Task 8: Wire server entry + full verification

**Files:**
- Modify: `apps/server/src/index.ts` (import the TTT logic - from Task 4 Step 5)

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Ensure `apps/server/src/index.ts` imports `tttLogic`** (as written in Task 4 Step 5) and passes it to `createServer`.

- [ ] **Step 2: Full fast-check floor**

Run: `pnpm typecheck` then `pnpm test`
Expected: all packages typecheck; all tests pass (protocol 6, sdk 4, server rooms 4 + server 1 + server.game 1, tictactoe 8). Process exits clean (no orphans).

- [ ] **Step 3: Bring the stack up** via `/supervised-run` (restart `hubbub:dev-all`).

- [ ] **Step 4: End-to-end verification (the Phase 1 success criteria)**

With Playwright (or manually): open the screen; open two controllers in isolated storage (second tab: clear localStorage before joining) so they become X and O; play a full row for X; confirm:
1. Screen shows the board updating after each move.
2. Turn indicator alternates.
3. Controllers disable cells when it is not their turn.
4. On three-in-a-row the screen shows "X wins!" and further taps are rejected.

Record pass/fail. Real two-phone play goes in `.for_bepy/BEPY_TODOS.md`.

- [ ] **Step 5: Commit the server wiring**

```bash
git add apps/server/src/index.ts
git commit -m "FEAT: serve Tic-Tac-Toe as the default game"
```

---

## Self-Review

**Spec coverage (Phase 1 scope):**
- GameDefinition contract (server logic / screen / controller, three parts) → Tasks 2, 5. ✓
- Input routing + Zod validation → Tasks 1, 2, 4 (`GameInstance.applyAction` + `actionSchema`). ✓
- Event-driven state sync (server-authoritative) → Task 4 (`broadcastGameState`). ✓
- Action-based input (games bind to logical actions, not raw keys) → controller emits `TTTAction` objects via `createActionSender`; physical keyboard/gamepad mapping is deferred to Phase 4 as planned. ✓
- First game validates the framework → Task 5 (TTT) + Task 8 (e2e). ✓
- Lobby/QR retained from Phase 0 → Task 6 (shown until 2 players assigned). ✓

**Deferred (correctly out of scope):** `tickRateHz`/real-time loop, WebRTC, Electron, cloud, multi-game lobby/registry, keyboard/gamepad physical input, Ultimate TTT (a follow-on game on the proven contract).

**Type consistency:** `GameLogic<State, Action>` signature identical across SDK (Task 2), server (Task 4), and the game (Task 5). `TTTState`/`TTTAction` shapes identical across logic, screen, controller, and both apps. Protocol `action`/`gameState` field names (`payload`, `state`) match between Task 1, the SDK helpers (Task 3), and the server (Task 4).

**Placeholder scan:** none - every step has concrete code/commands.

**Known test limitation:** two players in one browser share localStorage (token collision); the e2e clears storage in the second tab to simulate a second device. True two-phone play is a manual BEPY todo.
