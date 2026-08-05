# Ultimate Tic-Tac-Toe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Ultimate Tic-Tac-Toe as a second game on the proven `GameLogic` contract (pure logic + screen + controller views + tests), plus a minimal env-var game selector so it can run end-to-end - while keeping plain Tic-Tac-Toe the default.

**Architecture:** A new `packages/games/ultimate-tictactoe` package mirrors the existing `packages/games/tictactoe` exactly (same `GameLogic` shape, same `./screen` / `./controller` subpath exports). The framework already owns rooms, join, sync, input routing - this game only implements server logic + two views. Game selection is a thin runtime switch: the server picks logic by `HUBBUB_GAME` (default `ttt`); the screen/controller apps pick the matching view by Vite's `VITE_GAME` (default `ttt`). NO lobby/game-picker UI is built (that is a deferred UX decision); the selector is a dev/runtime mechanism only.

**Tech Stack:** TypeScript, Zod (action schema), React (views), Vitest. Same toolchain as the existing game.

## Global Constraints

- **A game implements only three parts:** server logic, screen view, controller view (`GameLogic<State, Action>` from `@hubbub/sdk`). The framework owns everything else. Do NOT touch rooms/transport/sync.
- **Input = logical actions, never raw keys.** The action is `{ board, cell }`, validated by a Zod `actionSchema`.
- **Turn-based = server-authoritative;** omit `tickRateHz` (this game has no real-time loop).
- **Transport is swappable;** never import a concrete transport into game/app code. Use the existing `useGameState` / `createActionSender` SDK helpers in the apps.
- **Mirror the existing `packages/games/tictactoe` package structure exactly** (package.json fields, tsconfig, `index.ts`/`logic.ts`/`screen.tsx`/`controller.tsx` split, `.js` import extensions in source).
- **Plain Tic-Tac-Toe stays the DEFAULT** served game (`HUBBUB_GAME`/`VITE_GAME` default to `ttt`), so the pending Phase 3 phone tests are unaffected.
- Monorepo: pnpm workspaces + Turborepo, **concurrency capped at 5**. `pnpm-workspace.yaml` already globs `packages/games/*` - do NOT edit it.
- **Subagents stage only; never commit.** The orchestrator runs `/commit` after each task.

---

### Task 1: `@hubbub/game-ultimate-tictactoe` package + logic + tests

**Files:**
- Create: `packages/games/ultimate-tictactoe/package.json`
- Create: `packages/games/ultimate-tictactoe/tsconfig.json`
- Create: `packages/games/ultimate-tictactoe/src/index.ts`
- Create: `packages/games/ultimate-tictactoe/src/logic.ts`
- Test: `packages/games/ultimate-tictactoe/src/logic.test.ts`

**Interfaces:**
- Produces: `utttLogic: GameLogic<UTTTState, UTTTAction>`, plus exported types `Mark`, `Cell`, `BoardResult`, `UTTTState`, `UTTTAction`, and `actionSchema`.
  ```ts
  type Mark = "X" | "O";
  type Cell = Mark | null;
  type BoardResult = Mark | "draw" | null;
  interface UTTTState {
    boards: Cell[][];          // 9 small boards, each 9 cells
    bigBoard: BoardResult[];   // result of each small board (9)
    turn: Mark;
    activeBoard: number | null; // small board that MUST be played in; null = any
    assignments: Record<string, Mark>;
    winner: BoardResult;       // overall winner: Mark | "draw" | null
  }
  interface UTTTAction { board: number; cell: number }
  ```

**Rules (Ultimate TTT):** A 3x3 grid of nine 3x3 boards. You place your mark in a cell of an allowed small board. Winning a small board (3-in-a-row) claims it on the big board; a full small board with no winner is a `"draw"` cell. Win 3 small boards in a line to win overall (all boards decided with no big line = overall `"draw"`). **The cell you play dictates which small board the opponent must play next** (`activeBoard = cell`). If that target board is already decided, the opponent may play anywhere (`activeBoard = null`). The first move (and any move when `activeBoard === null`) may be in any undecided board.

- [ ] **Step 1: Create the package manifest** (mirror `packages/games/tictactoe/package.json`, renamed)

`packages/games/ultimate-tictactoe/package.json`:
```json
{
  "name": "@hubbub/game-ultimate-tictactoe",
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
  "devDependencies": { "typescript": "^5.5.0", "react": "^18.3.0", "@types/react": "^18.3.0" }
}
```

- [ ] **Step 2: Create the tsconfig**: copy `packages/games/tictactoe/tsconfig.json` verbatim (it already has the correct relative `extends` path for this directory depth).

- [ ] **Step 3: Create the barrel** `packages/games/ultimate-tictactoe/src/index.ts`:
```ts
export * from "./logic.js";
```

- [ ] **Step 4: Write the failing tests**

`packages/games/ultimate-tictactoe/src/logic.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { utttLogic } from "./logic.js";
import type { UTTTState } from "./logic.js";

const P = [
  { id: "a", name: "Ann" },
  { id: "b", name: "Bo" },
];
const fresh = (): UTTTState => utttLogic.init(P);
const move = (s: UTTTState, id: string, board: number, cell: number) =>
  utttLogic.onAction(s, id, { board, cell });

describe("ultimate tic-tac-toe logic", () => {
  it("initializes 9 empty boards, X to move, no forced board", () => {
    const s = fresh();
    expect(s.boards).toHaveLength(9);
    expect(s.boards.every((b) => b.length === 9 && b.every((c) => c === null))).toBe(true);
    expect(s.bigBoard).toEqual(Array(9).fill(null));
    expect(s.turn).toBe("X");
    expect(s.activeBoard).toBeNull();
    expect(s.assignments).toEqual({ a: "X", b: "O" });
    expect(s.winner).toBeNull();
  });

  it("first move may be in any board and sets the next forced board to the cell played", () => {
    const s = move(fresh(), "a", 4, 2); // X plays board 4, cell 2
    expect(s.boards[4][2]).toBe("X");
    expect(s.turn).toBe("O");
    expect(s.activeBoard).toBe(2); // opponent must play board 2
  });

  it("rejects a move outside the forced board", () => {
    const s1 = move(fresh(), "a", 4, 2); // forces board 2
    const s2 = move(s1, "b", 5, 0); // O tries board 5 (not 2)
    expect(s2).toBe(s1); // unchanged
  });

  it("accepts a move inside the forced board", () => {
    const s1 = move(fresh(), "a", 4, 2); // forces board 2
    const s2 = move(s1, "b", 2, 7);
    expect(s2.boards[2][7]).toBe("O");
    expect(s2.activeBoard).toBe(7);
  });

  it("ignores a move on an occupied cell (board allowed)", () => {
    let s = move(fresh(), "a", 0, 0); // X b0c0 -> forces board 0, turn O
    s = move(s, "b", 0, 0);           // O tries the same occupied cell (board 0 is allowed)
    expect(s.boards[0][0]).toBe("X");
    expect(s.turn).toBe("O");         // rejected: still O's turn
  });

  it("ignores a move when it is not your turn", () => {
    const s = move(fresh(), "b", 0, 0); // O cannot move first
    expect(s.boards[0][0]).toBeNull();
    expect(s.turn).toBe("X");
  });

  it("ignores a spectator's move", () => {
    const s = move(fresh(), "zzz", 0, 0);
    expect(s.boards[0][0]).toBeNull();
  });

  it("winning a small board records the mark on the big board", () => {
    // X wins small board 0 with the top row (cells 0,1,2),
    // steering O between boards so X keeps returning to board 0.
    let s = fresh();
    s = move(s, "a", 0, 0); // X b0c0 -> forces board 0
    s = move(s, "b", 0, 3); // O b0c3 -> forces board 3
    s = move(s, "a", 3, 0); // X b3c0 -> forces board 0
    s = move(s, "b", 0, 4); // O b0c4 -> forces board 4
    s = move(s, "a", 4, 0); // X b4c0 -> forces board 0
    s = move(s, "b", 0, 5); // O b0c5 -> forces board 5
    s = move(s, "a", 5, 0); // X b5c0 -> forces board 0
    s = move(s, "b", 0, 6); // O b0c6 -> forces board 6
    s = move(s, "a", 6, 1); // X b6c1 -> forces board 1
    s = move(s, "b", 1, 0); // O b1c0 -> forces board 0
    s = move(s, "a", 0, 1); // X b0c1 -> forces board 1
    s = move(s, "b", 1, 3); // O b1c3 -> forces board 3
    s = move(s, "a", 3, 2); // X b3c2 -> forces board 2
    s = move(s, "b", 2, 0); // O b2c0 -> forces board 0
    s = move(s, "a", 0, 2); // X b0c2 -> top row of board 0 complete
    expect(s.bigBoard[0]).toBe("X");
  });

  it("frees the forced board (play anywhere) when sent to a decided board", () => {
    // Reuse the win above: after X claims board 0, the move that claimed it
    // (b0c2) would force board 2, which is still open - so to test the
    // 'decided board' rule we construct a direct case:
    let s = fresh();
    // Manually drive X to win board 0 ending on a cell that points back to board 0.
    s = move(s, "a", 0, 1); // X b0c1 -> board 1
    s = move(s, "b", 1, 0); // O b1c0 -> board 0
    s = move(s, "a", 0, 2); // X b0c2 -> board 2
    s = move(s, "b", 2, 0); // O b2c0 -> board 0
    s = move(s, "a", 0, 0); // X b0c0 -> top row done, board 0 decided; cell 0 -> board 0 (now decided)
    expect(s.bigBoard[0]).toBe("X");
    expect(s.activeBoard).toBeNull(); // sent to board 0 which is decided -> anywhere
  });

  it("a full small board with no winner becomes a draw cell", () => {
    // Fill board 0 to a draw pattern: X O X / X O O / O X X (no line),
    // steering O back to board 0 each time via cell 0 (-> board 0).
    let s = fresh();
    const seq: Array<["a" | "b", number, number]> = [
      ["a", 0, 0], // X b0c0 -> board 0
      ["b", 0, 1], // O b0c1 -> board 1
      ["a", 1, 0], // X b1c0 -> board 0
      ["b", 0, 2], // O b0c2 -> board 2
      ["a", 2, 0], // X b2c0 -> board 0
      ["b", 0, 4], // O b0c4 -> board 4
      ["a", 4, 0], // X b4c0 -> board 0
      ["b", 0, 3], // O b0c3 -> board 3
      ["a", 3, 0], // X b3c0 -> board 0
      ["b", 0, 6], // O b0c6 -> board 6
      ["a", 6, 0], // X b6c0 -> board 0
      ["b", 0, 5], // O b0c5 -> board 5
      ["a", 5, 0], // X b5c0 -> board 0
      ["b", 0, 8], // O b0c8 -> board 8
      ["a", 8, 0], // X b8c0 -> board 0
      ["b", 0, 7], // O b0c7 -> board 0 full
    ];
    for (const [id, b, c] of seq) s = move(s, id, b, c);
    // board 0 cells now: 0=X 1=O 2=O 3=O 4=O 5=O 6=X 7=O 8=X  (no 3-in-a-row)
    expect(s.boards[0].every((c) => c !== null)).toBe(true);
    expect(s.bigBoard[0]).toBe("draw");
  });

  // IMPLEMENTER: add a test "declares an overall winner when a mark claims three
  // small boards in a line". Build a real move sequence (driving `move(...)`)
  // that makes X claim small boards 0, 1, and 2 (a top-row line on the big
  // board), running it against utttLogic as you go to get the steering right.
  // Then assert BOTH:
  //   expect(s.winner).toBe("X");
  //   const after = move(s, "b", <a legal-looking board>, <cell>);
  //   expect(after).toBe(s);   // no moves accepted after the game is won
  // Do NOT hand-wave this with expect(true) - it must exercise real overall-win
  // detection and the post-win lockout.
});
```

> **Implementer note for Step 4:** The two tests marked with inline notes (the "not your turn" assertion line and the final "overall winner" test) contain illustrative/placeholder sequences. You MUST replace them with real, verified sequences that exercise the stated behavior against the actual `utttLogic`, with concrete assertions (no `expect(true).toBe(true)`). Keep all the other tests as written. The stated REQUIREMENTS are firm: (a) a move when it is not your turn returns the state unchanged; (b) after one mark claims three small boards in a big-board line, `state.winner` equals that mark and subsequent moves are rejected (state unchanged). Add a draw-of-the-whole-game test only if time permits.

- [ ] **Step 5: Run the tests to verify they fail**

Run: `pnpm vitest run packages/games/ultimate-tictactoe/src/logic.test.ts`
Expected: FAIL - cannot resolve `./logic.js`.

- [ ] **Step 6: Implement the logic**

`packages/games/ultimate-tictactoe/src/logic.ts`:
```ts
import { z } from "zod";
import type { GameLogic, PlayerInfo } from "@hubbub/sdk";

export type Mark = "X" | "O";
export type Cell = Mark | null;
export type BoardResult = Mark | "draw" | null;

export interface UTTTState {
  boards: Cell[][];
  bigBoard: BoardResult[];
  turn: Mark;
  activeBoard: number | null;
  assignments: Record<string, Mark>;
  winner: BoardResult;
}

export interface UTTTAction {
  board: number;
  cell: number;
}

export const actionSchema = z.object({
  board: z.number().int().min(0).max(8),
  cell: z.number().int().min(0).max(8),
});

const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

/** Returns a Mark only when three equal marks line up. "draw"/null never form a line. */
function lineWinner(cells: BoardResult[]): Mark | null {
  for (const [a, b, c] of LINES) {
    const v = cells[a];
    if ((v === "X" || v === "O") && v === cells[b] && v === cells[c]) return v;
  }
  return null;
}

/** Result of one small board: a Mark, "draw" if full with no winner, else null. */
function smallResult(board: Cell[]): BoardResult {
  const w = lineWinner(board);
  if (w) return w;
  return board.every((c) => c !== null) ? "draw" : null;
}

function assign(players: PlayerInfo[]): Record<string, Mark> {
  const out: Record<string, Mark> = {};
  if (players[0]) out[players[0].id] = "X";
  if (players[1]) out[players[1].id] = "O";
  return out;
}

export const utttLogic: GameLogic<UTTTState, UTTTAction> = {
  meta: { name: "Ultimate Tic-Tac-Toe", minPlayers: 2, maxPlayers: 2 },
  actionSchema,

  init: (players) => ({
    boards: Array.from({ length: 9 }, () => Array(9).fill(null)),
    bigBoard: Array(9).fill(null),
    turn: "X",
    activeBoard: null,
    assignments: assign(players),
    winner: null,
  }),

  onPlayersChanged: (state, players) => {
    const assignments = { ...state.assignments };
    const taken = new Set(Object.values(assignments));
    for (const p of players) {
      if (assignments[p.id]) continue;
      if (!taken.has("X")) { assignments[p.id] = "X"; taken.add("X"); }
      else if (!taken.has("O")) { assignments[p.id] = "O"; taken.add("O"); }
    }
    return { ...state, assignments };
  },

  onAction: (state, playerId, action) => {
    if (state.winner) return state;
    const mark = state.assignments[playerId];
    if (!mark || mark !== state.turn) return state;

    const { board, cell } = action;
    if (state.bigBoard[board] !== null) return state;            // board already decided
    if (state.activeBoard !== null && board !== state.activeBoard) return state; // wrong board
    if (state.boards[board][cell] !== null) return state;        // cell occupied

    const boards = state.boards.map((b, i) => (i === board ? b.slice() : b));
    boards[board][cell] = mark;

    const bigBoard = state.bigBoard.slice();
    bigBoard[board] = smallResult(boards[board]);

    const overall = lineWinner(bigBoard);
    const winner: BoardResult = overall
      ? overall
      : bigBoard.every((r) => r !== null) ? "draw" : null;

    const nextActive = bigBoard[cell] !== null ? null : cell;

    return {
      ...state,
      boards,
      bigBoard,
      turn: mark === "X" ? "O" : "X",
      activeBoard: winner ? null : nextActive,
      winner,
    };
  },
};
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `pnpm install` (registers the new workspace package), then `pnpm vitest run packages/games/ultimate-tictactoe/src/logic.test.ts`
Expected: PASS (all tests, with the two illustrative tests replaced by real verified sequences). Then `pnpm --filter @hubbub/game-ultimate-tictactoe typecheck` - no errors.

- [ ] **Step 8: Stage changes**: stage the five new files + updated `pnpm-lock.yaml`. Do NOT commit.

---

### Task 2: Screen + controller views

**Files:**
- Create: `packages/games/ultimate-tictactoe/src/screen.tsx`
- Create: `packages/games/ultimate-tictactoe/src/controller.tsx`

**Interfaces:**
- Consumes: `UTTTState`, `UTTTAction`, `BoardResult` from `./logic.js`.
- Produces: `UTTTScreen({ state }: { state: UTTTState })` and `UTTTController({ state, playerId, send }: { state: UTTTState; playerId: string; send: (a: UTTTAction) => void })` - same prop shapes as the tictactoe views.

- [ ] **Step 1: Implement the screen view**

`packages/games/ultimate-tictactoe/src/screen.tsx`:
```tsx
import type { UTTTState } from "./logic.js";

export function UTTTScreen({ state }: { state: UTTTState }) {
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
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 8,
          width: 360,
          margin: "0 auto",
        }}
      >
        {state.bigBoard.map((res, b) => {
          const active =
            state.winner === null &&
            res === null &&
            (state.activeBoard === null || state.activeBoard === b);
          return (
            <div
              key={b}
              style={{
                border: active ? "3px solid #22aa77" : "2px solid #ccc",
                padding: 2,
              }}
            >
              {res ? (
                <div
                  style={{
                    height: 116,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 64,
                    color: res === "draw" ? "#999" : "#222",
                  }}
                >
                  {res === "draw" ? "–" : res}
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1 }}>
                  {state.boards[b].map((cell, c) => (
                    <div
                      key={c}
                      style={{
                        height: 36,
                        border: "1px solid #ddd",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 22,
                      }}
                    >
                      {cell}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Implement the controller view**

`packages/games/ultimate-tictactoe/src/controller.tsx`:
```tsx
import type { UTTTState, UTTTAction } from "./logic.js";

export function UTTTController({
  state,
  playerId,
  send,
}: {
  state: UTTTState;
  playerId: string;
  send: (a: UTTTAction) => void;
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
          gap: 6,
          maxWidth: 360,
          margin: "0 auto",
        }}
      >
        {state.bigBoard.map((res, b) => {
          const boardPlayable =
            yourTurn && res === null && (state.activeBoard === null || state.activeBoard === b);
          return (
            <div
              key={b}
              style={{
                border: boardPlayable ? "2px solid #22aa77" : "1px solid #ccc",
                padding: 2,
                opacity: res ? 0.5 : 1,
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 1,
              }}
            >
              {state.boards[b].map((cell, c) => (
                <button
                  key={c}
                  disabled={!boardPlayable || cell !== null}
                  onClick={() => send({ board: b, cell: c })}
                  style={{ aspectRatio: "1", fontSize: 14, padding: 0 }}
                >
                  {cell ?? (res && c === 4 ? (res === "draw" ? "–" : res) : "")}
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify typecheck**

Run: `pnpm --filter @hubbub/game-ultimate-tictactoe typecheck`
Expected: no errors. (Views are presentational; no unit test, consistent with the tictactoe package which does not test its views.)

- [ ] **Step 4: Stage changes**: stage the two view files. Do NOT commit.

---

### Task 3: Server game selection + integration test

**Files:**
- Modify: `apps/server/src/index.ts`
- Modify: `apps/server/package.json` (add the new game dependency)
- Test: `apps/server/src/server.uttt.test.ts`

**Interfaces:**
- Consumes: `utttLogic` from `@hubbub/game-ultimate-tictactoe`, `tttLogic` from `@hubbub/game-tictactoe`, existing `createServer`.
- Produces: the standalone server now selects its game from `process.env.HUBBUB_GAME` (`ttt` | `uttt`), defaulting to `ttt`.

- [ ] **Step 1: Add the dependency**: in `apps/server/package.json`, add to `dependencies`:
```json
    "@hubbub/game-ultimate-tictactoe": "workspace:*",
```

- [ ] **Step 2: Write the failing integration test**

`apps/server/src/server.uttt.test.ts` (mirrors `server.game.test.ts`, but drives `utttLogic` through the real server over `ws`):
```ts
import { describe, it, expect, afterEach } from "vitest";
import { WebSocket } from "ws";
import { utttLogic } from "@hubbub/game-ultimate-tictactoe";
import { createServer } from "./server.js";

let handle: ReturnType<typeof createServer> | undefined;
afterEach(async () => await handle?.close());

const open = (port: number) =>
  new Promise<WebSocket>((res, rej) => {
    const ws = new WebSocket(`ws://localhost:${port}`);
    ws.on("open", () => res(ws));
    ws.on("error", rej);
  });
const nextOf = (ws: WebSocket, t: string) =>
  new Promise<any>((res, rej) => {
    const timer = setTimeout(() => rej(new Error(`timed out waiting for "${t}"`)), 4000);
    const h = (m: any) => {
      const msg = JSON.parse(m.toString());
      if (msg.t === t) {
        clearTimeout(timer);
        ws.off("message", h);
        res(msg);
      }
    };
    ws.on("message", h);
  });

describe("createServer with Ultimate Tic-Tac-Toe", () => {
  it("broadcasts initial state, applies a move, and updates the forced board", async () => {
    handle = createServer(0, utttLogic);
    const port = (handle.wss.address() as { port: number }).port;

    const screen = await open(port);
    screen.send(JSON.stringify({ t: "createRoom" }));
    const created = await nextOf(screen, "roomCreated");

    const controller = await open(port);
    controller.send(JSON.stringify({ t: "joinRoom", code: created.code, name: "Ann" }));
    await nextOf(controller, "joined");

    const initial = await nextOf(screen, "gameState");
    expect(initial.state.boards).toHaveLength(9);
    expect(initial.state.activeBoard).toBeNull();
    expect(initial.state.turn).toBe("X");

    // The first joiner is X; play board 4, cell 2.
    controller.send(JSON.stringify({ t: "action", payload: { board: 4, cell: 2 } }));
    const after = await nextOf(screen, "gameState");
    expect(after.state.boards[4][2]).toBe("X");
    expect(after.state.turn).toBe("O");
    expect(after.state.activeBoard).toBe(2);

    screen.close();
    controller.close();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm vitest run apps/server/src/server.uttt.test.ts`
Expected: FAIL - cannot resolve `@hubbub/game-ultimate-tictactoe` until `pnpm install` is run; run `pnpm install` first, then it should fail only if the server selection / game isn't wired - but this test passes `utttLogic` directly to `createServer`, so after install it should PASS already (the test does not depend on Step 4's env switch). If it passes here, that is expected and fine; Step 4 still adds the env selector for the standalone CLI.

- [ ] **Step 4: Wire game selection in the standalone server**

Replace `apps/server/src/index.ts` with:
```ts
import { createServer } from "./server.js";
import { tttLogic } from "@hubbub/game-tictactoe";
import { utttLogic } from "@hubbub/game-ultimate-tictactoe";
import type { GameLogic } from "@hubbub/sdk";

const GAMES: Record<string, GameLogic<any, any>> = {
  ttt: tttLogic,
  uttt: utttLogic,
};

const gameId = process.env.HUBBUB_GAME ?? "ttt";
const game = GAMES[gameId] ?? tttLogic;

const port = Number(process.env.PORT ?? 7787);
createServer(port, game);
console.log(`Hubbub server listening on ws://0.0.0.0:${port} (game: ${gameId in GAMES ? gameId : "ttt"})`);
```

- [ ] **Step 5: Verify**

Run: `pnpm install`, then `pnpm vitest run apps/server/src/server.uttt.test.ts` (expect PASS) and `pnpm --filter @hubbub/server typecheck` (no errors).

- [ ] **Step 6: Stage changes**: stage `apps/server/src/index.ts`, `apps/server/package.json`, `apps/server/src/server.uttt.test.ts`, and `pnpm-lock.yaml`. Do NOT commit.

---

### Task 4: Screen + controller app game selection

**Files:**
- Create: `apps/screen/src/game.tsx`
- Create: `apps/controller/src/game.tsx`
- Modify: `apps/screen/src/App.tsx`
- Modify: `apps/controller/src/App.tsx`
- Modify: `apps/screen/package.json`, `apps/controller/package.json` (add the new game dependency)

**Interfaces:**
- Produces: `GameScreen` (screen app) and `GameController` (controller app) - the view components for the game selected by `import.meta.env.VITE_GAME` (`ttt` | `uttt`), defaulting to `ttt`. The apps become game-agnostic at the view boundary (state typed `any`).

- [ ] **Step 1: Add deps**: add to BOTH `apps/screen/package.json` and `apps/controller/package.json` `dependencies`:
```json
    "@hubbub/game-ultimate-tictactoe": "workspace:*",
```

- [ ] **Step 2: Screen game registry** `apps/screen/src/game.tsx`:
```tsx
import type { ComponentType } from "react";
import { TTTScreen } from "@hubbub/game-tictactoe/screen";
import { UTTTScreen } from "@hubbub/game-ultimate-tictactoe/screen";

type ScreenComponent = ComponentType<{ state: any }>;

const SCREENS: Record<string, ScreenComponent> = {
  ttt: TTTScreen as ScreenComponent,
  uttt: UTTTScreen as ScreenComponent,
};

const id = (import.meta.env.VITE_GAME as string) || "ttt";
export const GameScreen: ScreenComponent = SCREENS[id] ?? SCREENS.ttt;
```

- [ ] **Step 3: Rewire screen App.tsx**: in `apps/screen/src/App.tsx`:
  - Replace the import `import { TTTScreen } from "@hubbub/game-tictactoe/screen";` and `import type { TTTState } from "@hubbub/game-tictactoe";` with `import { GameScreen } from "./game";`.
  - Change `const game = useGameState<TTTState>(transport);` to `const game = useGameState<any>(transport);`.
  - Change `<TTTScreen state={game} />` to `<GameScreen state={game} />`.
  - Leave everything else (room creation, QR, player list, the `started` check on `game.assignments`) unchanged - both game states expose `assignments`.

- [ ] **Step 4: Controller game registry** `apps/controller/src/game.tsx`:
```tsx
import type { ComponentType } from "react";
import { TTTController } from "@hubbub/game-tictactoe/controller";
import { UTTTController } from "@hubbub/game-ultimate-tictactoe/controller";

type ControllerComponent = ComponentType<{
  state: any;
  playerId: string;
  send: (a: any) => void;
}>;

const CONTROLLERS: Record<string, ControllerComponent> = {
  ttt: TTTController as ControllerComponent,
  uttt: UTTTController as ControllerComponent,
};

const id = (import.meta.env.VITE_GAME as string) || "ttt";
export const GameController: ControllerComponent = CONTROLLERS[id] ?? CONTROLLERS.ttt;
```

- [ ] **Step 5: Rewire controller App.tsx**: in `apps/controller/src/App.tsx`:
  - Replace `import { TTTController } from "@hubbub/game-tictactoe/controller";` and `import type { TTTState, TTTAction } from "@hubbub/game-tictactoe";` with `import { GameController } from "./game";`.
  - Change `const game = useGameState<TTTState>(transport);` to `const game = useGameState<any>(transport);`.
  - Change `createActionSender<TTTAction>(transportRef.current!)` to `createActionSender<any>(transportRef.current!)`.
  - Change `<TTTController ... />` to `<GameController ... />` (same props).
  - Leave join logic untouched.

- [ ] **Step 6: Verify builds (default still ttt)**

Run: `pnpm install`, then:
- `pnpm --filter @hubbub/screen typecheck` and `pnpm --filter @hubbub/controller typecheck` - no errors.
- `pnpm --filter @hubbub/screen build` and `pnpm --filter @hubbub/controller build` - both succeed (default game = ttt, proving no regression to Phase 3).

- [ ] **Step 7: Stage changes**: stage the two new `game.tsx` files, the two modified `App.tsx` files, both modified `package.json` files, and `pnpm-lock.yaml`. Do NOT commit.

---

## Post-plan verification (orchestrator, lead session)

1. **Full checks:** `pnpm typecheck` (8 packages), `pnpm test` (the prior 44 + new uttt logic + integration tests), `pnpm -w build`.
2. **Optional live playthrough (Ultimate TTT):** run `apps/server` with `HUBBUB_GAME=uttt` and the dev screen/controller with `VITE_GAME=uttt`, then drive a short two-player game in the browser (Playwright) to confirm the views render and a move steers the forced board. Keep this lean; the logic is already exhaustively unit-tested. Default (no env) must still serve plain TTT.

## Open follow-ups (not in this plan - flagged for Bepy)

- **Lobby / game-picker UI** (the real way players choose a game) is a deferred UX decision - the env-var selector is a stopgap so the game is runnable/testable.
- Wiring `HUBBUB_GAME` into the Electron host (`host.ts`) so the portable app can serve Ultimate TTT (currently host defaults to plain TTT; trivial once the lobby/selection UX is decided).
- Ultimate TTT view polish (active-board glow, last-move highlight, responsive sizing on small phones).
