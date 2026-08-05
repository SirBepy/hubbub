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

function MiniSubBoard({
  cells,
  result,
  tappable,
  forced,
  forcedColor,
  xColor,
  oColor,
  onCell,
}: {
  cells: Cell[];
  result: BoardResult;
  tappable: boolean;
  forced: boolean;
  forcedColor: string;
  xColor: string;
  oColor: string;
  onCell: (cell: number) => void;
}) {
  const dim = !result && !tappable;
  return (
    <div
      style={{
        position: "relative",
        aspectRatio: "1",
        borderRadius: "var(--radius-sm)",
        border: forced ? `2px solid ${forcedColor}` : "1px solid var(--divider)",
        background: forced ? hexToRgba(forcedColor, 0.13) : "var(--surface-1)",
        boxShadow: forced ? `0 0 16px ${hexToRgba(forcedColor, 0.28)}` : "none",
        opacity: dim ? 0.45 : 1,
        overflow: "hidden",
        transition: "opacity 150ms ease-out, border-color 150ms ease-out, box-shadow 150ms ease-out",
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
        }}
      >
        {cells.map((cell, c) => (
          <button
            key={c}
            type="button"
            disabled={!tappable || cell !== null}
            onClick={() => onCell(c)}
            style={{
              background: "var(--surface-1)",
              border: "none",
              padding: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: tappable && !cell ? "pointer" : "default",
            }}
          >
            {cell ? (
              <span style={{ font: `700 ${forced ? 18 : 14}px/1 var(--font-display)`, color: cell === "X" ? xColor : oColor }}>
                {cell}
              </span>
            ) : null}
          </button>
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
  // Any-board-allowed would light every open sub-board at once — over budget — so the glow
  // moves to the status chip instead; a specific forced board keeps it locally.
  const chipGlow = yourTurn && state.activeBoard === null;

  const statusLabel = !mark ? "SPECTATING" : state.winner ? "GAME OVER" : yourTurn ? "YOUR MOVE" : "THEIR TURN";

  const you = players.find((p) => p.id === playerId) ?? null;
  const opponentId = Object.keys(state.assignments).find(
    (id) => id !== playerId && state.assignments[id] === opponentMark,
  );
  const opponent = players.find((p) => p.id === opponentId) ?? null;

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
