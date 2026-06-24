import type { UTTTState } from "./logic.js";

export function UTTTScreen({ state }: { state: UTTTState }) {
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
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 8,
          width: 360,
          margin: "0 auto",
        }}
      >
        {state.bigBoard.map((res, b) => {
          const active =
            state.winner === null &&
            res === null &&
            (state.activeBoard === null || state.activeBoard === b);
          return (
            <div
              key={b}
              style={{
                border: active ? "3px solid #22aa77" : "2px solid #ccc",
                padding: 2,
              }}
            >
              {res ? (
                <div
                  style={{
                    height: 116,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 64,
                    color: res === "draw" ? "#999" : "#222",
                  }}
                >
                  {res === "draw" ? "–" : res}
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1 }}>
                  {state.boards[b].map((cell, c) => (
                    <div
                      key={c}
                      style={{
                        height: 36,
                        border: "1px solid #ddd",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 22,
                      }}
                    >
                      {cell}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
