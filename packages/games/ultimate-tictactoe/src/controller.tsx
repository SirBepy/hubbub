import { useState } from "react";
import { colorHex, hexToRgba, MiniIdentity } from "@hubbub/ui";
import type { DisplayPlayer as Player } from "@hubbub/sdk";
import type { BoardResult, Cell, Mark, UTTTAction, UTTTState } from "./logic.js";
import { utttLogic } from "./logic.js";

export type UTTTControllerProps = {
  state: UTTTState;
  playerId: string;
  players: Player[];
  send: (action: UTTTAction) => void;
};

const [X_COLOR_ID, O_COLOR_ID] = utttLogic.meta.identityColors ?? [3, 5];

// 46px keeps every cell button above the 44px phone-target floor no matter how narrow the
// 3-across sub-board grid gets on a 390px phone; the sub-board's own width still shrinks to
// fit its column, only its height is pinned.
const MINI_CELL_PX = 46;

/** Feature-detected: desktop test browsers and iOS Safari have no Vibration API. */
function vibrate(pattern: number | number[]) {
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    navigator.vibrate(pattern);
  }
}

function MiniSubBoard({
  cells,
  result,
  tappable,
  forced,
  forcedColor,
  xColor,
  oColor,
  pressedCell,
  onPress,
  onRelease,
  onCell,
}: {
  cells: Cell[];
  result: BoardResult;
  tappable: boolean;
  forced: boolean;
  forcedColor: string;
  xColor: string;
  oColor: string;
  pressedCell: number | null;
  onPress: (cell: number) => void;
  onRelease: () => void;
  onCell: (cell: number) => void;
}) {
  const dim = !result && !tappable;
  return (
    <div
      style={{
        position: "relative",
        height: MINI_CELL_PX * 3 + 2,
        borderRadius: "var(--radius-sm)",
        border: forced ? `2px solid ${forcedColor}` : "1px solid var(--divider)",
        background: forced ? hexToRgba(forcedColor, 0.13) : "var(--surface-1)",
        boxShadow: forced ? `0 0 16px ${hexToRgba(forcedColor, 0.28)}` : "none",
        opacity: dim ? 0.45 : 1,
        overflow: "hidden",
        transition: "opacity 150ms ease-out, border-color 240ms ease-out, box-shadow 240ms ease-out",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gridTemplateRows: `repeat(3, ${MINI_CELL_PX}px)`,
          gap: 1,
          background: "var(--divider)",
          width: "100%",
          height: "100%",
        }}
      >
        {cells.map((cell, c) => {
          const cellTappable = tappable && cell === null;
          const pressed = pressedCell === c;
          return (
            <button
              key={c}
              type="button"
              disabled={!cellTappable}
              onPointerDown={() => cellTappable && onPress(c)}
              onPointerUp={onRelease}
              onPointerLeave={onRelease}
              onPointerCancel={onRelease}
              onClick={() => {
                onCell(c);
                vibrate(15);
              }}
              style={{
                background: "var(--surface-1)",
                border: "none",
                padding: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: cellTappable ? "pointer" : "default",
                transform: pressed ? "scale(0.94)" : "scale(1)",
                transition: "transform 100ms ease-out",
              }}
            >
              {cell ? (
                <span style={{ font: `700 ${forced ? 18 : 14}px/1 var(--font-display)`, color: cell === "X" ? xColor : oColor }}>
                  {cell}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      {result ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: result === "draw" ? "rgba(15,16,26,.6)" : hexToRgba(result === "X" ? xColor : oColor, 0.28),
          }}
        >
          <span style={{ font: "700 28px/1 var(--font-display)", color: result === "draw" ? "var(--text-faint)" : result === "X" ? xColor : oColor }}>
            {result === "draw" ? "–" : result}
          </span>
        </div>
      ) : null}
    </div>
  );
}

export function UTTTController({ state, playerId, players, send }: UTTTControllerProps) {
  const mark = state.assignments[playerId];
  const opponentMark: Mark = mark === "O" ? "X" : "O";
  const yourColor = colorHex(mark === "O" ? O_COLOR_ID : X_COLOR_ID);
  const opponentColor = colorHex(opponentMark === "O" ? O_COLOR_ID : X_COLOR_ID);
  const yourTurn = !state.winner && !!mark && mark === state.turn;
  const forcedBoard = yourTurn ? state.activeBoard : null;
  // Any-board-allowed would light every open sub-board at once, over budget, so the glow
  // moves to the status chip instead; a specific forced board keeps it locally.
  const chipGlow = yourTurn && state.activeBoard === null;

  const statusLabel = !mark ? "SPECTATING" : state.winner ? "GAME OVER" : yourTurn ? "YOUR MOVE" : "THEIR TURN";

  const you = players.find((p) => p.id === playerId) ?? null;
  const opponentId = Object.keys(state.assignments).find(
    (id) => id !== playerId && state.assignments[id] === opponentMark,
  );
  const opponent = players.find((p) => p.id === opponentId) ?? null;

  // (board, cell) under a live pointer press, for the scale-down tap feedback.
  const [pressed, setPressed] = useState<{ board: number; cell: number } | null>(null);

  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
      <div
        style={{
          display: "inline-flex",
          alignSelf: "flex-start",
          alignItems: "center",
          padding: chipGlow ? "6px 12px" : 0,
          borderRadius: "var(--radius-md)",
          border: chipGlow ? `2px solid ${yourColor}` : "none",
          background: chipGlow ? hexToRgba(yourColor, 0.13) : "transparent",
          boxShadow: chipGlow ? `0 0 16px ${hexToRgba(yourColor, 0.28)}` : "none",
          font: "600 11px var(--font-ui)",
          letterSpacing: "0.14em",
          color: yourTurn ? yourColor : "var(--text-muted)",
          transition: "all 150ms ease-out",
        }}
      >
        {statusLabel}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4 }}>
        {state.bigBoard.map((result, b) => {
          const tappable = yourTurn && result === null && (state.activeBoard === null || state.activeBoard === b);
          return (
            <MiniSubBoard
              key={b}
              cells={state.boards[b]}
              result={result}
              tappable={tappable}
              forced={forcedBoard === b}
              forcedColor={yourColor}
              xColor={colorHex(X_COLOR_ID)}
              oColor={colorHex(O_COLOR_ID)}
              pressedCell={pressed?.board === b ? pressed.cell : null}
              onPress={(cell) => setPressed({ board: b, cell })}
              onRelease={() => setPressed(null)}
              onCell={(cell) => send({ board: b, cell })}
            />
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
