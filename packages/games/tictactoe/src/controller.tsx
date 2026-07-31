import { Avatar, colorHex } from "@hubbub/ui";
import type { Mark, TTTAction, TTTState } from "./logic.js";
import { tttLogic } from "./logic.js";

/** Player shape from @hubbub/protocol; kept local — protocol isn't a direct dep of this package. */
type Player = { id: string; name: string; colorId: number; emoji: string; connected: boolean };

export type TTTControllerProps = {
  state: TTTState;
  playerId: string;
  players: Player[];
  send: (action: TTTAction) => void;
};

const [X_COLOR_ID, O_COLOR_ID] = tttLogic.meta.identityColors ?? [1, 0];

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function MiniIdentity({
  player,
  mark,
  roleColor,
  emphasized,
}: {
  player: Player | null;
  mark: Mark;
  roleColor: string;
  emphasized: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 10px",
        borderRadius: "var(--radius-md)",
        border: emphasized ? `1px solid ${roleColor}` : "1px solid var(--divider)",
        opacity: player && !player.connected ? 0.45 : 1,
        transition: "border-color 150ms ease-out",
      }}
    >
      {player ? (
        <Avatar size={32} colorHex={colorHex(player.colorId)} emoji={player.emoji} />
      ) : (
        <div style={{ width: 32, height: 32 }} />
      )}
      <span style={{ font: "700 16px var(--font-display)", color: roleColor }}>{mark}</span>
    </div>
  );
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
          return (
            <button
              key={i}
              type="button"
              disabled={!tappable}
              onClick={() => send({ cell: i })}
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
                transition: "border-color 150ms ease-out",
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
