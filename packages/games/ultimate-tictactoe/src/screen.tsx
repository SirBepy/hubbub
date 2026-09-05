import { useEffect, useRef, useState } from "react";
import { sfx } from "@hubbub/sdk/sfx";
import { colorHex, IdentityCard, hexToRgba } from "@hubbub/ui";
import type { DisplayPlayer as Player } from "@hubbub/sdk";
import type { BoardResult, Cell, UTTTState } from "./logic.js";
import { utttLogic } from "./logic.js";

export type UTTTScreenProps = { state: UTTTState; players: Player[] };

const [X_COLOR_ID, O_COLOR_ID] = utttLogic.meta.identityColors ?? [3, 5];

// View-only: the same eight lines as a small board, reused to find the winning three
// sub-boards for the celebration pulse. Not game logic - logic.ts owns the authoritative copy.
const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

function winningBoards(bigBoard: BoardResult[]): number[] {
  for (const line of LINES) {
    const [a, b, c] = line;
    if (bigBoard[a] && bigBoard[a] !== "draw" && bigBoard[a] === bigBoard[b] && bigBoard[a] === bigBoard[c]) return line;
  }
  return [];
}

const EASE_OUT = "cubic-bezier(0.16, 1, 0.3, 1)";
const DROP_MS = 180;
const STAMP_MS = 220;
const FORCE_PULSE_MS = 320;
const WIN_PULSE_MS = 320;
const WIN_PULSE_STAGGER_MS = 90;
const BANNER_MS = 280;
const WIN_FANFARE_DELAY_MS = 2 * WIN_PULSE_STAGGER_MS + WIN_PULSE_MS + BANNER_MS;

const MOTION_STYLE_ID = "uttt-screen-motion";
const MOTION_CSS = `
@keyframes uttt-drop-in {
  from { transform: scale(1.5); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
@keyframes uttt-stamp-in {
  from { transform: scale(1.6); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
@keyframes uttt-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.02); }
}
@keyframes uttt-banner-in {
  from { transform: translateY(calc(var(--u) * 0.5)); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
@media (prefers-reduced-motion: reduce) {
  .uttt-drop-in,
  .uttt-stamp-in,
  .uttt-force-pulse,
  .uttt-win-pulse,
  .uttt-banner-in {
    animation: none !important;
  }
}
`;

/** Injects this game's keyframes once per document; guarded so remounts (StrictMode,
 * reconnects) never duplicate the <style> tag. */
function useMotionStyles() {
  useEffect(() => {
    if (typeof document === "undefined" || document.getElementById(MOTION_STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = MOTION_STYLE_ID;
    style.textContent = MOTION_CSS;
    document.head.appendChild(style);
  }, []);
}

function SubBoard({
  cells,
  result,
  glowing,
  glowColor,
  xColor,
  oColor,
  justPlacedCell,
  pulsing,
  onPulseEnd,
  winCelebrating,
  winPulseDelayMs,
}: {
  cells: Cell[];
  result: BoardResult;
  glowing: boolean;
  glowColor: string;
  xColor: string;
  oColor: string;
  justPlacedCell: number | null;
  pulsing: boolean;
  onPulseEnd: () => void;
  winCelebrating: boolean;
  winPulseDelayMs: number;
}) {
  const pulseClass = winCelebrating ? "uttt-win-pulse" : pulsing ? "uttt-force-pulse" : undefined;
  const pulseAnimation = winCelebrating
    ? `uttt-pulse ${WIN_PULSE_MS}ms ${EASE_OUT} ${winPulseDelayMs}ms both`
    : pulsing
      ? `uttt-pulse ${FORCE_PULSE_MS}ms ${EASE_OUT}`
      : undefined;

  return (
    <div
      className={pulseClass}
      onAnimationEnd={pulsing ? onPulseEnd : undefined}
      style={{
        position: "relative",
        width: "calc(var(--u) * 14)",
        height: "calc(var(--u) * 14)",
        borderRadius: "var(--radius-sm)",
        border: glowing ? `2px solid ${glowColor}` : "1px solid var(--divider)",
        background: glowing ? hexToRgba(glowColor, 0.13) : "var(--surface-1)",
        boxShadow: glowing ? `0 0 28px ${hexToRgba(glowColor, 0.3)}` : "none",
        overflow: "hidden",
        transition: "border-color 260ms ease-out, box-shadow 260ms ease-out, background 260ms ease-out",
        animation: pulseAnimation,
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gridTemplateRows: "repeat(3, 1fr)",
          gap: 1,
          background: "var(--divider)",
          width: "100%",
          height: "100%",
          opacity: result ? 0.25 : 1,
          transition: "opacity 240ms ease-out",
        }}
      >
        {cells.map((cell, c) => (
          <div key={c} style={{ background: "var(--surface-1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {cell ? (
              <span
                className={c === justPlacedCell ? "uttt-drop-in" : undefined}
                style={{
                  font: "700 40px/1 var(--font-display)",
                  color: cell === "X" ? xColor : oColor,
                  animation: c === justPlacedCell ? `uttt-drop-in ${DROP_MS}ms ${EASE_OUT}` : undefined,
                }}
              >
                {cell}
              </span>
            ) : null}
          </div>
        ))}
      </div>
      {result ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: result === "draw" ? "transparent" : hexToRgba(result === "X" ? xColor : oColor, 0.25),
          }}
        >
          <span
            className="uttt-stamp-in"
            style={{
              font: `700 ${result === "draw" ? 72 : 120}px/1 var(--font-display)`,
              color: result === "draw" ? "var(--text-faint)" : result === "X" ? xColor : oColor,
              animation: `uttt-stamp-in ${STAMP_MS}ms ${EASE_OUT}`,
            }}
          >
            {result === "draw" ? "–" : result}
          </span>
        </div>
      ) : null}
    </div>
  );
}

export function UTTTScreen({ state, players }: UTTTScreenProps) {
  useMotionStyles();
  const xColor = colorHex(X_COLOR_ID);
  const oColor = colorHex(O_COLOR_ID);
  const xPlayer = players.find((p) => state.assignments[p.id] === "X") ?? null;
  const oPlayer = players.find((p) => state.assignments[p.id] === "O") ?? null;
  const turnColor = state.turn === "X" ? xColor : oColor;
  // Any-board-allowed play would light every open sub-board at once, over budget, so the
  // glow moves to the turn-holder's bookend card instead; a forced sub-board keeps it locally.
  const anyBoardTurnGlow = !state.winner && state.activeBoard === null;

  // Diffed against the previous nested board (not derived from a truthy cell, which never
  // reverts to null) so only the just-placed mark animates on this render.
  const prevBoardsRef = useRef<Cell[][]>(state.boards);
  const [lastPlaced, setLastPlaced] = useState<{ board: number; cell: number } | null>(null);
  useEffect(() => {
    const prev = prevBoardsRef.current;
    let found: { board: number; cell: number } | null = null;
    for (let b = 0; b < state.boards.length && !found; b++) {
      for (let c = 0; c < state.boards[b].length; c++) {
        if (state.boards[b][c] !== null && prev[b]?.[c] === null) {
          found = { board: b, cell: c };
          break;
        }
      }
    }
    if (found) {
      setLastPlaced(found);
      sfx.play("lock");
    }
    prevBoardsRef.current = state.boards;
  }, [state.boards]);

  // Sub-board decisions: pop for a captured board, a soft wrong for a drawn one.
  const prevBigBoardRef = useRef(state.bigBoard);
  useEffect(() => {
    const prev = prevBigBoardRef.current;
    state.bigBoard.forEach((result, b) => {
      if (result && !prev[b]) {
        if (result === "draw") sfx.play("wrong", { gain: 0.3 });
        else sfx.play("pop");
      }
    });
    prevBigBoardRef.current = state.bigBoard;
  }, [state.bigBoard]);

  // The forced-board handover pulse: a one-shot class add/remove cleared by onAnimationEnd
  // rather than a timer, so it can never drift out of sync with the animation's real length.
  const prevActiveRef = useRef(state.activeBoard);
  const [pulsingBoard, setPulsingBoard] = useState<number | null>(null);
  useEffect(() => {
    const prevActive = prevActiveRef.current;
    if (state.activeBoard !== null && state.activeBoard !== prevActive) {
      setPulsingBoard(state.activeBoard);
      sfx.play("tick", { gain: 0.5 });
    }
    prevActiveRef.current = state.activeBoard;
  }, [state.activeBoard]);

  const prevWinnerRef = useRef(state.winner);
  useEffect(() => {
    if (state.winner && state.winner !== "draw" && !prevWinnerRef.current) {
      sfx.play("correct");
      sfx.play("fanfare", { delayMs: WIN_FANFARE_DELAY_MS, gain: 0.7 });
    }
    prevWinnerRef.current = state.winner;
  }, [state.winner]);

  const winLineBoards = state.winner && state.winner !== "draw" ? winningBoards(state.bigBoard) : [];

  // The player's own name, never their hue: colour stopped carrying identity once rooms outgrew
  // six players. Colouring the X and O pieces is still the game's call; naming a person is not.
  const sideLabel = (side: "X" | "O") => ((side === "X" ? xPlayer?.name : oPlayer?.name) ?? side).toUpperCase();

  const statusText =
    state.winner === "draw"
      ? "DRAW"
      : state.winner
        ? `${sideLabel(state.winner)} WINS`
        : state.activeBoard === null
          ? `${sideLabel(state.turn)} PLAYS · ANY BOARD`
          : `${sideLabel(state.turn)} PLAYS · BOARD ${state.activeBoard + 1}`;

  return (
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 24,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 64 }}>
        <IdentityCard mark="X" roleColor={xColor} player={xPlayer} glowing={anyBoardTurnGlow && state.turn === "X"} />
        <div
          style={{
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--divider)",
            background: "var(--surface-1)",
            padding: 24,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, calc(var(--u) * 14))",
              gridTemplateRows: "repeat(3, calc(var(--u) * 14))",
              gap: 12,
            }}
          >
            {state.bigBoard.map((result, b) => (
              <SubBoard
                key={b}
                cells={state.boards[b]}
                result={result}
                glowing={!state.winner && state.activeBoard === b}
                glowColor={turnColor}
                xColor={xColor}
                oColor={oColor}
                justPlacedCell={lastPlaced?.board === b ? lastPlaced.cell : null}
                pulsing={pulsingBoard === b}
                onPulseEnd={() => setPulsingBoard(null)}
                winCelebrating={winLineBoards.includes(b)}
                winPulseDelayMs={winLineBoards.indexOf(b) * WIN_PULSE_STAGGER_MS}
              />
            ))}
          </div>
        </div>
        <IdentityCard mark="O" roleColor={oColor} player={oPlayer} glowing={anyBoardTurnGlow && state.turn === "O"} />
      </div>
      <div
        key={state.winner ? "result" : "playing"}
        className={state.winner ? "uttt-banner-in" : undefined}
        style={{
          font: "500 22px var(--font-ui)",
          letterSpacing: "0.12em",
          color: "var(--text-muted)",
          animation: state.winner ? `uttt-banner-in ${BANNER_MS}ms ${EASE_OUT}` : undefined,
        }}
      >
        {statusText}
      </div>
    </div>
  );
}
