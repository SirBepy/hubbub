import type { TTTState } from "./logic.js";

export function TTTScreen({ state }: { state: TTTState }) {
  const status =
    state.winner === "draw"
      ? "Draw!"
      : state.winner
        ? `${state.winner} wins!`
        : `${state.turn} to move`;

  return (
    <div style={{ textAlign: "center", fontFamily: "system-ui" }}>
      <h2>{status}</h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 96px)",
          gap: 6,
          justifyContent: "center",
        }}
      >
        {state.board.map((cell, i) => (
          <div
            key={i}
            style={{
              width: 96,
              height: 96,
              border: "2px solid #333",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 56,
            }}
          >
            {cell}
          </div>
        ))}
      </div>
    </div>
  );
}
