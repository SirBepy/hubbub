import { Avatar, colorHex, colorName } from "@hubbub/ui";
import type { BoardResult, Cell, Mark, UTTTState } from "./logic.js";
import { utttLogic } from "./logic.js";

/** Player shape from @hubbub/protocol; kept local — protocol isn't a direct dep of this package. */
type Player = { id: string; name: string; colorId: number; emoji: string; connected: boolean };

export type UTTTScreenProps = { state: UTTTState; players: Player[] };

const [X_COLOR_ID, O_COLOR_ID] = utttLogic.meta.identityColors ?? [3, 5];

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
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

function SubBoard({
  cells,
  result,
  glowing,
  glowColor,
  xColor,
  oColor,
}: {
  cells: Cell[];
  result: BoardResult;
  glowing: boolean;
  glowColor: string;
  xColor: string;
  oColor: string;
}) {
  return (
    <div
      style={{
        position: "relative",
        width: 200,
        height: 200,
        borderRadius: "var(--radius-sm)",
        border: glowing ? `2px solid ${glowColor}` : "1px solid var(--divider)",
        background: glowing ? hexToRgba(glowColor, 0.13) : "var(--surface-1)",
        boxShadow: glowing ? `0 0 28px ${hexToRgba(glowColor, 0.3)}` : "none",
        overflow: "hidden",
        transition: "border-color 150ms ease-out, box-shadow 150ms ease-out, background 150ms ease-out",
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
          opacity: result ? 0.25 : 1,
        }}
      >
        {cells.map((cell, c) => (
          <div key={c} style={{ background: "var(--surface-1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {cell ? <span style={{ font: "700 40px/1 var(--font-display)", color: cell === "X" ? xColor : oColor }}>{cell}</span> : null}
          </div>
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
            background: result === "draw" ? "transparent" : hexToRgba(result === "X" ? xColor : oColor, 0.25),
          }}
        >
          <span
            style={{
              font: `700 ${result === "draw" ? 72 : 120}px/1 var(--font-display)`,
              color: result === "draw" ? "var(--text-faint)" : result === "X" ? xColor : oColor,
            }}
          >
            {result === "draw" ? "–" : result}
          </span>
        </div>
      ) : null}
    </div>
  );
}

export function UTTTScreen({ state, players }: UTTTScreenProps) {
  const xColor = colorHex(X_COLOR_ID);
  const oColor = colorHex(O_COLOR_ID);
  const xPlayer = players.find((p) => state.assignments[p.id] === "X") ?? null;
  const oPlayer = players.find((p) => state.assignments[p.id] === "O") ?? null;
  const turnColor = state.turn === "X" ? xColor : oColor;
  // Any-board-allowed play would light every open sub-board at once — over budget — so the
  // glow moves to the turn-holder's bookend card instead; a forced sub-board keeps it locally.
  const anyBoardTurnGlow = !state.winner && state.activeBoard === null;

  const statusText =
    state.winner === "draw"
      ? "DRAW"
      : state.winner
        ? `${colorName(state.winner === "X" ? X_COLOR_ID : O_COLOR_ID).toUpperCase()} WINS`
        : state.activeBoard === null
          ? `${colorName(state.turn === "X" ? X_COLOR_ID : O_COLOR_ID).toUpperCase()} PLAYS · ANY BOARD`
          : `${colorName(state.turn === "X" ? X_COLOR_ID : O_COLOR_ID).toUpperCase()} PLAYS · BOARD ${state.activeBoard + 1}`;

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
        <IdentityCard mark="X" roleColor={xColor} player={xPlayer} glowing={anyBoardTurnGlow && state.turn === "X"} />
        <div
          style={{
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--divider)",
            background: "var(--surface-1)",
            padding: 24,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 200px)",
              gridTemplateRows: "repeat(3, 200px)",
              gap: 12,
            }}
          >
            {state.bigBoard.map((result, b) => (
              <SubBoard
                key={b}
                cells={state.boards[b]}
                result={result}
                glowing={!state.winner && state.activeBoard === b}
                glowColor={turnColor}
                xColor={xColor}
                oColor={oColor}
              />
            ))}
          </div>
        </div>
        <IdentityCard mark="O" roleColor={oColor} player={oPlayer} glowing={anyBoardTurnGlow && state.turn === "O"} />
      </div>
      <div style={{ font: "500 22px var(--font-ui)", letterSpacing: "0.12em", color: "var(--text-muted)" }}>
        {statusText}
      </div>
    </div>
  );
}
