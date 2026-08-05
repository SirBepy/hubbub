import { Avatar, colorHex, colorName, hexToRgba } from "@hubbub/ui";
import type { DisplayPlayer as Player } from "@hubbub/sdk";
import type { Cell, Mark, TTTState } from "./logic.js";
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

function IdentityCard({
  mark,
  roleColor,
  player,
  glowing,
}: {
  mark: Mark;
  roleColor: string;
  player: Player | null;
  glowing: boolean;
}) {
  return (
    <div
      style={{
        width: 280,
        flex: "none",
        borderRadius: "var(--radius-md)",
        border: glowing ? `2px solid ${roleColor}` : "1px solid var(--divider)",
        background: glowing ? hexToRgba(roleColor, 0.13) : "var(--surface-1)",
        boxShadow: glowing ? `0 0 28px ${hexToRgba(roleColor, 0.3)}` : "none",
        padding: 24,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
        opacity: player && !player.connected ? 0.45 : 1,
        transition: "border-color 150ms ease-out, box-shadow 150ms ease-out, background 150ms ease-out",
      }}
    >
      {player ? (
        <Avatar size={56} colorHex={colorHex(player.colorId)} emoji={player.emoji} surface={2} />
      ) : (
        <div style={{ width: 56, height: 56 }} />
      )}
      <div style={{ font: "500 22px var(--font-ui)", color: "var(--text-primary)" }}>
        {player?.name ?? "Waiting…"}
      </div>
      <div style={{ font: "700 72px/1 var(--font-display)", color: roleColor }}>{mark}</div>
      <div style={{ font: "500 13px var(--font-ui)", letterSpacing: "0.12em", color: "var(--text-muted)" }}>
        {mark}
      </div>
    </div>
  );
}

export function TTTScreen({ state, players }: TTTScreenProps) {
  const xColor = colorHex(X_COLOR_ID);
  const oColor = colorHex(O_COLOR_ID);
  const xPlayer = players.find((p) => state.assignments[p.id] === "X") ?? null;
  const oPlayer = players.find((p) => state.assignments[p.id] === "O") ?? null;
  const winLine = state.winner && state.winner !== "draw" ? winningCells(state.board) : [];
  const winTint = state.winner === "X" ? xColor : state.winner === "O" ? oColor : null;

  const statusText =
    state.winner === "draw"
      ? "DRAW"
      : state.winner
        ? `${colorName(state.winner === "X" ? X_COLOR_ID : O_COLOR_ID).toUpperCase()} WINS`
        : `${colorName(state.turn === "X" ? X_COLOR_ID : O_COLOR_ID).toUpperCase()} PLAYS`;

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
            border: "1px solid var(--divider)",
            background: "var(--surface-1)",
            padding: 24,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 140px)",
              gridTemplateRows: "repeat(3, 140px)",
              gap: 1,
              background: "var(--divider)",
            }}
          >
            {state.board.map((cell, i) => (
              <div
                key={i}
                style={{
                  background: winLine.includes(i) && winTint ? hexToRgba(winTint, 0.12) : "var(--surface-1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "background 150ms ease-out",
                }}
              >
                {cell ? (
                  <span style={{ font: "700 96px/1 var(--font-display)", color: cell === "X" ? xColor : oColor }}>
                    {cell}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
        <IdentityCard mark="O" roleColor={oColor} player={oPlayer} glowing={!state.winner && state.turn === "O"} />
      </div>
      <div style={{ font: "500 22px var(--font-ui)", letterSpacing: "0.12em", color: "var(--text-muted)" }}>
        {statusText}
      </div>
    </div>
  );
}
