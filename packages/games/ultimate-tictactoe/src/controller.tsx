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
        You are <strong>{mark ?? "—"}</strong> · {status}
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
