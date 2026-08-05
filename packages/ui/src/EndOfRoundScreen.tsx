import { PLAYER_COLORS, colorHex, hexToRgba } from "./palette";
import { GlowButton, NeutralButton } from "./GlowButton";
import { Avatar } from "./Avatar";

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
  /** Optional - some games (Tic-Tac-Toe) have no scores. */
  breakdown?: EndOfRoundBreakdownRow[];
  standings?: EndOfRoundStandingRow[];
  showActions: boolean;
  /** TV renders actions as non-interactive display affordances; phones drive them. */
  onRematch?: () => void;
  onBack?: () => void;
};

/** The reusable end-of-round template - platform-level, game-agnostic. Fluid, sized off --u. */
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
        flex: 1,
        minHeight: 0,
        width: "100%",
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
          padding: "calc(var(--u)*2.5) calc(var(--u)*3.4)",
          display: "flex",
          flexDirection: "column",
          gap: "calc(var(--u)*1.7)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "calc(var(--u)*1.3)" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: "calc(var(--u)*2.1)", letterSpacing: "0.02em", color: "#f7f1e2" }}>
              HUB<span style={{ color: "var(--accent)" }}>BUB</span>
            </div>
            <div style={{ fontSize: "calc(var(--u)*1.5)", fontWeight: 600, color: "rgba(242,234,217,.6)" }}>
              {gameName} · {roundLabel}
            </div>
          </div>
          <div style={{ fontSize: "calc(var(--u)*1.4)", fontWeight: 500, color: "rgba(242,234,217,.45)" }}>
            Room {roomCode} · {playerCount} players
          </div>
        </div>

        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "calc(var(--u)*3.4)" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: "calc(var(--u)*.85)" }}>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "calc(var(--u)*27)",
                lineHeight: 0.8,
                color: winner ? winner.colorHex : "rgba(242,234,217,.45)",
                textShadow: winner ? `0 0 calc(var(--u)*3) ${hexToRgba(winner.colorHex, 0.35)}` : "none",
                animation: "hb-rank-in 400ms cubic-bezier(.2,.8,.2,1) 1 both",
              }}
            >
              {winner ? winner.rankLabel : "–"}
            </div>
            {winner ? (
              <div style={{ fontFamily: "var(--font-display)", fontSize: "calc(var(--u)*3.4)", color: "rgba(242,234,217,.5)", letterSpacing: "0.08em" }}>
                {winner.rankSuffix}
              </div>
            ) : null}
          </div>

          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "calc(var(--u)*.85)", maxWidth: "calc(var(--u)*40)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "calc(var(--u)*.85)" }}>
              {winner ? (
                <>
                  <span style={{ width: "calc(var(--u)*1.05)", height: "calc(var(--u)*1.05)", borderRadius: "50%", background: winner.colorHex }} />
                  {/* size 56 matches IdentityCard's prominent-identity avatar */}
                  <Avatar size={56} colorHex={winner.colorHex} emoji={winner.emoji} surface={2} />
                  <span style={{ fontSize: "calc(var(--u)*2.9)", fontWeight: 600 }}>{winner.name}</span>
                </>
              ) : (
                <span style={{ fontSize: "calc(var(--u)*2.9)", fontWeight: 600, color: "rgba(242,234,217,.65)" }}>It's a draw</span>
              )}
            </div>
            <div style={{ height: 1, background: "var(--divider-heavy)" }} />
            {breakdown?.map((row) => (
              <div key={row.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "calc(var(--u)*.65) 0" }}>
                <span style={{ fontSize: "calc(var(--u)*1.6)", color: "rgba(242,234,217,.65)" }}>{row.label}</span>
                <span
                  style={{
                    fontSize: "calc(var(--u)*1.6)",
                    fontWeight: 600,
                    color: row.positive ? "var(--player-lime)" : "rgba(242,234,217,.45)",
                  }}
                >
                  {row.value}
                </span>
              </div>
            ))}
            {showActions ? (
              <div style={{ display: "flex", gap: "calc(var(--u)*.85)", marginTop: "calc(var(--u)*.85)", height: 64 }}>
                {/* No onRematch/onBack from the TV: disabled visually signals "phones drive this", not a dead click. */}
                <GlowButton colorHex={colorHex(1)} height={64} label="Rematch" onClick={onRematch} fullWidth={false} disabled={!onRematch} />
                <NeutralButton height={64} label="Back to lobby" onClick={onBack} fullWidth={false} disabled={!onBack} />
              </div>
            ) : null}
          </div>

          {standings?.length ? (
            <div style={{ width: "calc(var(--u)*22)", display: "flex", flexDirection: "column", gap: "calc(var(--u)*.45)" }}>
              <div style={{ fontSize: "calc(var(--u)*1.2)", fontWeight: 600, letterSpacing: "0.14em", color: "rgba(242,234,217,.45)", marginBottom: "calc(var(--u)*.45)" }}>
                STANDINGS
              </div>
              {standings.map((row) => (
                <div
                  key={row.position}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "calc(var(--u)*.65)",
                    background: "var(--surface-1)",
                    border: "1px solid var(--divider)",
                    borderRadius: "var(--radius-md)",
                    padding: "calc(var(--u)*.65) calc(var(--u)*.85)",
                  }}
                >
                  <span style={{ fontSize: "calc(var(--u)*1.4)", fontWeight: 600, color: "rgba(242,234,217,.4)", width: "calc(var(--u)*1.7)" }}>{row.position}</span>
                  <span style={{ width: "calc(var(--u)*.65)", height: "calc(var(--u)*.65)", borderRadius: "50%", background: row.colorHex }} />
                  {/* size 32 matches lobby/MiniIdentity's compact-row avatar */}
                  <Avatar size={32} colorHex={row.colorHex} emoji={row.emoji} surface={2} />
                  <span style={{ flex: 1, fontSize: "calc(var(--u)*1.4)", fontWeight: 500 }}>{row.name}</span>
                  <span style={{ fontSize: "calc(var(--u)*1.4)", fontWeight: 600, color: "rgba(242,234,217,.7)" }}>{row.score}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
