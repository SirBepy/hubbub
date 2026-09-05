import { useState } from "react";
import { colorHex, hexToRgba, MiniIdentity } from "@hubbub/ui";
import type { DisplayPlayer as Player } from "@hubbub/sdk";
import type { Mark, TTTAction, TTTState } from "./logic.js";
import { tttLogic } from "./logic.js";

export type TTTControllerProps = {
  state: TTTState;
  playerId: string;
  players: Player[];
  send: (action: TTTAction) => void;
};

const [X_COLOR_ID, O_COLOR_ID] = tttLogic.meta.identityColors ?? [1, 0];

/** Feature-detected: desktop test browsers and iOS Safari have no Vibration API. */
function vibrate(pattern: number | number[]) {
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    navigator.vibrate(pattern);
  }
}

export function TTTController({ state, playerId, players, send }: TTTControllerProps) {
  const mark = state.assignments[playerId];
  const opponentMark: Mark = mark === "O" ? "X" : "O";
  const yourColor = colorHex(mark === "O" ? O_COLOR_ID : X_COLOR_ID);
  const opponentColor = colorHex(opponentMark === "O" ? O_COLOR_ID : X_COLOR_ID);
  const yourTurn = !state.winner && !!mark && mark === state.turn;

  const statusLabel = !mark ? "SPECTATING" : state.winner ? "GAME OVER" : yourTurn ? "YOUR MOVE" : "THEIR TURN";

  const you = players.find((p) => p.id === playerId) ?? null;
  const opponentId = Object.keys(state.assignments).find(
    (id) => id !== playerId && state.assignments[id] === opponentMark,
  );
  const opponent = players.find((p) => p.id === opponentId) ?? null;

  // Which cell is under a live pointer press, for the scale-down tap feedback.
  const [pressedCell, setPressedCell] = useState<number | null>(null);

  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
      <div
        style={{
          font: "600 11px var(--font-ui)",
          letterSpacing: "0.14em",
          color: yourTurn ? yourColor : "var(--text-muted)",
          transition: "color 150ms ease-out",
        }}
      >
        {statusLabel}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 8,
          borderRadius: "var(--radius-md)",
          border: yourTurn ? `2px solid ${yourColor}` : "1px solid transparent",
          boxShadow: yourTurn ? `0 0 18px ${hexToRgba(yourColor, 0.28)}` : "none",
          padding: yourTurn ? 7 : 8,
          transition: "border-color 150ms ease-out, box-shadow 150ms ease-out",
        }}
      >
        {state.board.map((cell, i) => {
          const tappable = yourTurn && cell === null;
          const pressed = pressedCell === i;
          return (
            <button
              key={i}
              type="button"
              disabled={!tappable}
              onPointerDown={() => tappable && setPressedCell(i)}
              onPointerUp={() => setPressedCell(null)}
              onPointerLeave={() => setPressedCell(null)}
              onPointerCancel={() => setPressedCell(null)}
              onClick={() => {
                send({ cell: i });
                vibrate(15);
              }}
              style={{
                aspectRatio: "1",
                minWidth: 88,
                minHeight: 88,
                background: "var(--surface-1)",
                borderRadius: "var(--radius-md)",
                border: tappable ? `1px solid ${hexToRgba(yourColor, 0.4)}` : "1px solid var(--divider)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: tappable ? "pointer" : "default",
                transform: pressed ? "scale(0.94)" : "scale(1)",
                transition: "border-color 150ms ease-out, transform 100ms ease-out",
              }}
            >
              {cell ? (
                <span style={{ font: "700 56px/1 var(--font-display)", color: cell === "X" ? colorHex(X_COLOR_ID) : colorHex(O_COLOR_ID) }}>
                  {cell}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <MiniIdentity player={you} mark={mark ?? "X"} roleColor={yourColor} emphasized={yourTurn} />
        <span style={{ font: "600 12px var(--font-ui)", color: "var(--text-faint)" }}>VS</span>
        <MiniIdentity
          player={opponent}
          mark={opponentMark}
          roleColor={opponentColor}
          emphasized={!yourTurn && !state.winner && !!opponent}
        />
      </div>
    </div>
  );
}
