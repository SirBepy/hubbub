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
    // X wins small board 0 with the top row (cells 0,1,2).
    // O is given cells c3, c6, c8 in board 0 (no line among those),
    // and is steered back to board 0 each time via cell=0 detours.
    //
    // NOTE: The original brief sequence gave O cells c3,c4,c5 in board 0,
    // which completes O's middle row before X can win. Fixed by assigning O
    // cells c3, c6, c8 instead (no three-in-a-row for O).
    let s = fresh();
    s = move(s, "a", 0, 0); //  1. X b0c0 -> active:b0
    s = move(s, "b", 0, 3); //  2. O b0c3 -> active:b3
    s = move(s, "a", 3, 0); //  3. X b3c0 -> active:b0
    s = move(s, "b", 0, 6); //  4. O b0c6 -> active:b6
    s = move(s, "a", 6, 0); //  5. X b6c0 -> active:b0
    s = move(s, "b", 0, 8); //  6. O b0c8 -> active:b8
    s = move(s, "a", 8, 1); //  7. X b8c1 -> active:b1
    s = move(s, "b", 1, 0); //  8. O b1c0 -> active:b0
    s = move(s, "a", 0, 1); //  9. X b0c1 -> active:b1
    s = move(s, "b", 1, 3); // 10. O b1c3 -> active:b3
    s = move(s, "a", 3, 2); // 11. X b3c2 -> active:b2
    s = move(s, "b", 2, 0); // 12. O b2c0 -> active:b0
    s = move(s, "a", 0, 2); // 13. X b0c2 -> top row of board 0 complete
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
    // Fill board 0 to draw pattern [X,X,O,O,O,X,X,O,X] (no line for either side).
    // Between consecutive board-0 plays, detour moves set active=0 by
    // playing cell=0 in an intermediate board, steering the next player
    // back to board 0 without ever occupying board-0 cells out of turn.
    //
    // NOTE: The original brief sequence gave O cells c1,c2,c3,c4,c5,c6,c7,c8
    // in board 0 (filling it completely with O except c0), which means O
    // completes the middle row (c3,c4,c5) before the board is full. Fixed by
    // using a balanced draw pattern with X@(c0,c1,c5,c6,c8) and
    // O@(c2,c3,c4,c7) - verified no three-in-a-row for either player.
    let s = fresh();
    const seq: Array<["a" | "b", number, number]> = [
      ["a", 0, 0], //  1. X b0c0 -> active:b0
      ["b", 0, 2], //  2. O b0c2 -> active:b2
      ["a", 2, 1], //  3. X b2c1 -> active:b1
      ["b", 1, 0], //  4. O b1c0 -> active:b0
      ["a", 0, 1], //  5. X b0c1 -> active:b1
      ["b", 1, 3], //  6. O b1c3 -> active:b3
      ["a", 3, 0], //  7. X b3c0 -> active:b0
      ["b", 0, 3], //  8. O b0c3 -> active:b3
      ["a", 3, 5], //  9. X b3c5 -> active:b5
      ["b", 5, 0], // 10. O b5c0 -> active:b0
      ["a", 0, 5], // 11. X b0c5 -> active:b5
      ["b", 5, 4], // 12. O b5c4 -> active:b4
      ["a", 4, 0], // 13. X b4c0 -> active:b0
      ["b", 0, 4], // 14. O b0c4 -> active:b4
      ["a", 4, 6], // 15. X b4c6 -> active:b6
      ["b", 6, 0], // 16. O b6c0 -> active:b0
      ["a", 0, 6], // 17. X b0c6 -> active:b6
      ["b", 6, 7], // 18. O b6c7 -> active:b7
      ["a", 7, 0], // 19. X b7c0 -> active:b0
      ["b", 0, 7], // 20. O b0c7 -> active:b7
      ["a", 7, 8], // 21. X b7c8 -> active:b8
      ["b", 8, 0], // 22. O b8c0 -> active:b0
      ["a", 0, 8], // 23. X b0c8 -> board 0 full
    ];
    for (const [id, b, c] of seq) s = move(s, id, b, c);
    // board 0: c0=X c1=X c2=O c3=O c4=O c5=X c6=X c7=O c8=X (no 3-in-a-row)
    expect(s.boards[0].every((c) => c !== null)).toBe(true);
    expect(s.bigBoard[0]).toBe("draw");
  });

  it("declares an overall winner when a mark claims three small boards in a line", () => {
    // X claims small boards 0, 1, and 2 (top row of the big board).
    //
    // Phase 1 (moves 1-13): X wins board 0 via top row (cells 0,1,2).
    //   O receives cells c3, c6, c8 in board 0 (no line).
    //   Detour moves steer each player back to board 0 via cell=0 in other boards.
    //
    // Phase 2 (moves 14-20): X wins board 1 via bottom row (cells 6,7,8).
    //   Board 1 already has O@c0 and O@c3 from Phase 1, so the top and
    //   middle rows are unavailable; X uses the bottom row instead.
    //
    // Phase 3 (moves 21-27): X wins board 2 via middle row (cells 3,4,5).
    //   Board 2 has O@c0 from Phase 1, and O@c1 from a Phase 2 detour.
    //   When O plays cell=1 in board 3 (step 24), active points to board 1
    //   which is now decided, so active becomes null and X can freely
    //   pick board 2 to complete the win.
    let s = fresh();

    // --- Phase 1: X wins board 0 ---
    s = move(s, "a", 0, 0); //  1. X b0c0 -> active:b0
    s = move(s, "b", 0, 3); //  2. O b0c3 -> active:b3
    s = move(s, "a", 3, 0); //  3. X b3c0 -> active:b0
    s = move(s, "b", 0, 6); //  4. O b0c6 -> active:b6
    s = move(s, "a", 6, 0); //  5. X b6c0 -> active:b0
    s = move(s, "b", 0, 8); //  6. O b0c8 -> active:b8
    s = move(s, "a", 8, 1); //  7. X b8c1 -> active:b1
    s = move(s, "b", 1, 0); //  8. O b1c0 -> active:b0
    s = move(s, "a", 0, 1); //  9. X b0c1 -> active:b1
    s = move(s, "b", 1, 3); // 10. O b1c3 -> active:b3
    s = move(s, "a", 3, 2); // 11. X b3c2 -> active:b2
    s = move(s, "b", 2, 0); // 12. O b2c0 -> active:b0
    s = move(s, "a", 0, 2); // 13. X b0c2 -> X wins board 0 (top row); active:b2

    expect(s.bigBoard[0]).toBe("X");

    // --- Phase 2: X wins board 1 via bottom row (c6,c7,c8) ---
    // Board 1 has O@c0(step8) and O@c3(step10); bottom row c6,c7,c8 all free.
    s = move(s, "b", 2, 1); // 14. O b2c1 -> active:b1  (b2c0=O from step12; c1 free)
    s = move(s, "a", 1, 6); // 15. X b1c6 -> active:b6  (b6c0=X from step5; c6 free)
    s = move(s, "b", 6, 1); // 16. O b6c1 -> active:b1  (b6c0=X; c1 free)
    s = move(s, "a", 1, 7); // 17. X b1c7 -> active:b7
    s = move(s, "b", 7, 1); // 18. O b7c1 -> active:b1  (b7 all free; c1)
    s = move(s, "a", 1, 8); // 19. X b1c8 -> X wins board 1 (bottom row); active:b8

    expect(s.bigBoard[1]).toBe("X");

    // --- Phase 3: X wins board 2 via middle row (c3,c4,c5) ---
    // Board 2: O@c0(step12), O@c1(step14). c3,c4,c5 all free.
    // active=b8 (b8c1=X from step7).
    s = move(s, "b", 8, 2); // 20. O b8c2 -> active:b2
    s = move(s, "a", 2, 3); // 21. X b2c3 -> active:b3
    // Board 3: X@c0(step3), X@c2(step11). c1 free.
    s = move(s, "b", 3, 1); // 22. O b3c1 -> active:b1 (decided!) -> active:null
    s = move(s, "a", 2, 4); // 23. X b2c4 (active=null, any board) -> active:b4
    // Board 4: all free.
    s = move(s, "b", 4, 2); // 24. O b4c2 -> active:b2
    s = move(s, "a", 2, 5); // 25. X b2c5 -> X wins board 2 (middle row); X wins overall!

    expect(s.bigBoard[2]).toBe("X");
    expect(s.winner).toBe("X");

    // Post-win lockout: no further moves accepted
    const after = move(s, "b", 3, 4); // O tries a legal-looking move in an undecided board
    expect(after).toBe(s);            // state unchanged
    expect(utttLogic.result!(s)).toEqual({ winnerId: "a", isDraw: false });
  });

  it("result() is null while the game is in progress", () => {
    expect(utttLogic.result!(fresh())).toBeNull();
  });

  it("result() reports isDraw when the big board result is a draw", () => {
    // Force a top-level draw by directly constructing a decided-but-unwon big board.
    let s = fresh();
    s = { ...s, bigBoard: ["X", "O", "X", "O", "X", "O", "O", "X", "O"], winner: "draw" };
    expect(utttLogic.result!(s)).toEqual({ winnerId: null, isDraw: true });
  });
});
