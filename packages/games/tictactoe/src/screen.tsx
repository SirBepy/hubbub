import { useEffect, useRef, useState } from "react";
import { sfx } from "@hubbub/sdk";
import { colorHex, IdentityCard, hexToRgba } from "@hubbub/ui";
import type { DisplayPlayer as Player } from "@hubbub/sdk";
import type { Cell, TTTState } from "./logic.js";
import { tttLogic } from "./logic.js";

export type TTTScreenProps = { state: TTTState; players: Player[] };

const [X_COLOR_ID, O_COLOR_ID] = tttLogic.meta.identityColors ?? [1, 0];

const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

/** View-only: which cells form the winning line, for the tint highlight. Not game logic. */
function winningCells(board: Cell[]): number[] {
  for (const line of LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return line;
  }
  return [];
}

const EASE_OUT = "cubic-bezier(0.16, 1, 0.3, 1)";
const DROP_MS = 180;
const WIN_TINT_MS = 160;
const WIN_TINT_STAGGER_MS = 90;
const BANNER_MS = 280;
// Fanfare lands as the banner does: the tint stagger's worst case (two gaps) plus its own
// fade, then the banner's own rise.
const WIN_FANFARE_DELAY_MS = 2 * WIN_TINT_STAGGER_MS + WIN_TINT_MS + BANNER_MS;

const MOTION_STYLE_ID = "ttt-screen-motion";
const MOTION_CSS = `
@keyframes ttt-drop-in {
  from { transform: scale(1.5); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
@keyframes ttt-win-tint {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes ttt-banner-in {
  from { transform: translateY(calc(var(--u) * 0.5)); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
@media (prefers-reduced-motion: reduce) {
  .ttt-drop-in,
  .ttt-win-tint,
  .ttt-banner-in {
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

export function TTTScreen({ state, players }: TTTScreenProps) {
  useMotionStyles();
  const xColor = colorHex(X_COLOR_ID);
  const oColor = colorHex(O_COLOR_ID);
  const xPlayer = players.find((p) => state.assignments[p.id] === "X") ?? null;
  const oPlayer = players.find((p) => state.assignments[p.id] === "O") ?? null;
  const winLine = state.winner && state.winner !== "draw" ? winningCells(state.board) : [];
  const winTint = state.winner === "X" ? xColor : state.winner === "O" ? oColor : null;

  // Diffed against the previous board (not derived from a truthy cell, which never reverts to
  // null) so only the just-placed mark animates - a spectator joining mid-game must not see
  // every existing mark replay its drop.
  const prevBoardRef = useRef<Cell[]>(state.board);
  const [lastPlaced, setLastPlaced] = useState<number | null>(null);
  useEffect(() => {
    const prev = prevBoardRef.current;
    const placedAt = state.board.findIndex((cell, i) => cell !== null && prev[i] === null);
    if (placedAt !== -1) {
      setLastPlaced(placedAt);
      sfx.play("lock");
    }
    prevBoardRef.current = state.board;
  }, [state.board]);

  const prevWinnerRef = useRef(state.winner);
  useEffect(() => {
    if (state.winner && !prevWinnerRef.current) {
      if (state.winner === "draw") {
        sfx.play("wrong", { gain: 0.35 });
      } else {
        sfx.play("correct");
        sfx.play("fanfare", { delayMs: WIN_FANFARE_DELAY_MS, gain: 0.7 });
      }
    }
    prevWinnerRef.current = state.winner;
  }, [state.winner]);

  // The player's own name, never their hue: colour stopped carrying identity once rooms outgrew
  // six players. Colouring the X and O pieces is still the game's call; naming a person is not.
  const sideLabel = (side: "X" | "O") => ((side === "X" ? xPlayer?.name : oPlayer?.name) ?? side).toUpperCase();

  const statusText =
    state.winner === "draw"
      ? "DRAW"
      : state.winner
        ? `${sideLabel(state.winner)} WINS`
        : `${sideLabel(state.turn)} PLAYS`;

  // A neutral border once the game has ended; otherwise a low-alpha tint of the turn colour, so
  // the handover reads without a second glow - the one glow stays the IdentityCard bookend.
  const turnBorderColor = state.winner ? "var(--divider)" : hexToRgba(state.turn === "X" ? xColor : oColor, 0.35);

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
        <IdentityCard mark="X" roleColor={xColor} player={xPlayer} glowing={!state.winner && state.turn === "X"} />
        <div
          style={{
            borderRadius: "var(--radius-md)",
            border: `1px solid ${turnBorderColor}`,
            background: "var(--surface-1)",
            padding: 24,
            overflow: "hidden",
            transition: "border-color 240ms ease-out",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, calc(var(--u) * 9))",
              gridTemplateRows: "repeat(3, calc(var(--u) * 9))",
              gap: 1,
              background: "var(--divider)",
            }}
          >
            {state.board.map((cell, i) => {
              const winOrder = winLine.indexOf(i);
              return (
                <div
                  key={i}
                  style={{
                    position: "relative",
                    background: "var(--surface-1)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {winOrder !== -1 && winTint ? (
                    <div
                      className="ttt-win-tint"
                      style={{
                        position: "absolute",
                        inset: 0,
                        background: hexToRgba(winTint, 0.12),
                        animation: `ttt-win-tint ${WIN_TINT_MS}ms ${EASE_OUT} ${winOrder * WIN_TINT_STAGGER_MS}ms both`,
                      }}
                    />
                  ) : null}
                  {cell ? (
                    <span
                      className={i === lastPlaced ? "ttt-drop-in" : undefined}
                      style={{
                        position: "relative",
                        zIndex: 1,
                        font: "700 96px/1 var(--font-display)",
                        color: cell === "X" ? xColor : oColor,
                        animation: i === lastPlaced ? `ttt-drop-in ${DROP_MS}ms ${EASE_OUT}` : undefined,
                      }}
                    >
                      {cell}
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
        <IdentityCard mark="O" roleColor={oColor} player={oPlayer} glowing={!state.winner && state.turn === "O"} />
      </div>
      <div
        key={state.winner ? "result" : "playing"}
        className={state.winner ? "ttt-banner-in" : undefined}
        style={{
          font: "500 22px var(--font-ui)",
          letterSpacing: "0.12em",
          color: "var(--text-muted)",
          animation: state.winner ? `ttt-banner-in ${BANNER_MS}ms ${EASE_OUT}` : undefined,
        }}
      >
        {statusText}
      </div>
    </div>
  );
}
