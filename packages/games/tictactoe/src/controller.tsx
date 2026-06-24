import type { TTTState, TTTAction } from "./logic.js";

export function TTTController({
  state,
  playerId,
  send,
}: {
  state: TTTState;
  playerId: string;
  send: (a: TTTAction) => void;
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
          gap: 8,
          maxWidth: 300,
          margin: "0 auto",
        }}
      >
        {state.board.map((cell, i) => (
          <button
            key={i}
            disabled={!yourTurn || cell !== null}
            onClick={() => send({ cell: i })}
            style={{ aspectRatio: "1", fontSize: 36 }}
          >
            {cell}
          </button>
        ))}
      </div>
    </div>
  );
}
