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
