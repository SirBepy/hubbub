import { PLAYER_COLORS, colorHex } from "./palette";
import { GlowButton, NeutralButton } from "./GlowButton";

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** One-shot confetti: 44 pieces cycling the six palette colors, staggered, never loops. */
function Confetti() {
  const pieces = Array.from({ length: 44 }, (_, i) => {
    const color = PLAYER_COLORS[i % 6].hex;
    const x = (i * 37 + (i % 5) * 11) % 100;
    const wide = i % 3 === 0;
    const duration = 1.6 + (i % 7) * 0.18;
    const delay = (i % 11) * 0.07;
    return (
      <span
        key={i}
        style={{
          position: "absolute",
          top: 0,
          left: `${x}%`,
          width: wide ? 16 : 10,
          height: wide ? 8 : 18,
          background: color,
          borderRadius: 2,
          opacity: 0,
          animation: `hb-confetti-fall ${duration}s cubic-bezier(.3,.6,.5,1) ${delay}s 1 forwards`,
        }}
      />
    );
  });
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>{pieces}</div>
  );
}

export type EndOfRoundWinner = {
  name: string;
  emoji: string;
  colorHex: string;
  /** e.g. "1" + rankSuffix "ST" */
  rankLabel: string;
  rankSuffix: string;
};

export type EndOfRoundBreakdownRow = {
  label: string;
  value: string;
  positive?: boolean;
};

export type EndOfRoundStandingRow = {
  position: number;
  name: string;
  emoji: string;
  colorHex: string;
  score: string;
};

export type EndOfRoundScreenProps = {
  gameName: string;
  roundLabel: string;
  roomCode: string;
  playerCount: number;
  /** null renders the neutral draw treatment (no confetti, no rank glow). */
  winner: EndOfRoundWinner | null;
  /** Optional — some games (Tic-Tac-Toe) have no scores. */
  breakdown?: EndOfRoundBreakdownRow[];
  standings?: EndOfRoundStandingRow[];
  showActions: boolean;
  /** TV renders actions as non-interactive display affordances; phones drive them. */
  onRematch?: () => void;
  onBack?: () => void;
};

/** The reusable 1g end-of-round template — platform-level, game-agnostic. */
export function EndOfRoundScreen({
  gameName,
  roundLabel,
  roomCode,
  playerCount,
  winner,
  breakdown,
  standings,
  showActions,
  onRematch,
  onBack,
}: EndOfRoundScreenProps) {
  return (
    <div
      style={{
        width: 1920,
        height: 1080,
        background: "var(--surface-0)",
        position: "relative",
        overflow: "hidden",
        color: "var(--text-primary)",
      }}
    >
      {winner ? <Confetti /> : null}
      <div
        style={{
          position: "relative",
          height: "100%",
          padding: "48px 64px",
          display: "flex",
          flexDirection: "column",
          gap: 32,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            <div style={{ font: "700 40px var(--font-display)", letterSpacing: "0.02em", color: "rgba(233,233,237,.7)" }}>
              HUBBUB
            </div>
            <div style={{ font: "600 28px var(--font-ui)", color: "rgba(233,233,237,.6)" }}>
              {gameName} · {roundLabel}
            </div>
          </div>
          <div style={{ font: "500 26px var(--font-ui)", color: "rgba(233,233,237,.45)" }}>
            Room {roomCode} · {playerCount} players
          </div>
        </div>

        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 64 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
            <div
              style={{
                font: "700 520px/0.8 var(--font-display)",
                color: winner ? winner.colorHex : "rgba(233,233,237,.45)",
                textShadow: winner ? `0 0 60px ${hexToRgba(winner.colorHex, 0.35)}` : "none",
                animation: "hb-rank-in 400ms cubic-bezier(.2,.8,.2,1) 1 both",
              }}
            >
              {winner ? winner.rankLabel : "—"}
            </div>
            {winner ? (
              <div style={{ font: "600 64px var(--font-display)", color: "rgba(233,233,237,.5)", letterSpacing: "0.08em" }}>
                {winner.rankSuffix}
              </div>
            ) : null}
          </div>

          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16, maxWidth: 760 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              {winner ? (
                <>
                  <span style={{ width: 20, height: 20, borderRadius: "50%", background: winner.colorHex }} />
                  <span style={{ fontSize: 44, lineHeight: 1 }}>{winner.emoji}</span>
                  <span style={{ font: "600 56px var(--font-ui)" }}>{winner.name}</span>
                </>
              ) : (
                <span style={{ font: "600 56px var(--font-ui)", color: "rgba(233,233,237,.65)" }}>It's a draw</span>
              )}
            </div>
            <div style={{ height: 1, background: "rgba(233,233,237,.14)" }} />
            {breakdown?.map((row) => (
              <div key={row.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0" }}>
                <span style={{ font: "400 30px var(--font-ui)", color: "rgba(233,233,237,.65)" }}>{row.label}</span>
                <span
                  style={{
                    font: "600 30px var(--font-ui)",
                    color: row.positive ? "var(--player-lime)" : "rgba(233,233,237,.45)",
                  }}
                >
                  {row.value}
                </span>
              </div>
            ))}
            {showActions ? (
              <div style={{ display: "flex", gap: 16, marginTop: 16, height: 88 }}>
                <GlowButton colorHex={colorHex(1)} height={88} label="Rematch" onClick={onRematch} fullWidth={false} />
                <NeutralButton height={88} label="Back to lobby" onClick={onBack} fullWidth={false} />
              </div>
            ) : null}
          </div>

          {standings?.length ? (
            <div style={{ width: 420, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ font: "600 22px var(--font-ui)", letterSpacing: "0.14em", color: "rgba(233,233,237,.45)", marginBottom: 8 }}>
                STANDINGS
              </div>
              {standings.map((row) => (
                <div
                  key={row.position}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    background: "var(--surface-1)",
                    border: "1px solid var(--divider)",
                    borderRadius: "var(--radius-md)",
                    padding: "12px 16px",
                  }}
                >
                  <span style={{ font: "600 26px var(--font-ui)", color: "rgba(233,233,237,.4)", width: 32 }}>{row.position}</span>
                  <span style={{ width: 12, height: 12, borderRadius: "50%", background: row.colorHex }} />
                  <span style={{ fontSize: 24, lineHeight: 1 }}>{row.emoji}</span>
                  <span style={{ flex: 1, font: "500 26px var(--font-ui)" }}>{row.name}</span>
                  <span style={{ font: "600 26px var(--font-ui)", color: "rgba(233,233,237,.7)" }}>{row.score}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
