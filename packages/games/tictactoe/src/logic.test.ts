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
