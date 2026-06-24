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
