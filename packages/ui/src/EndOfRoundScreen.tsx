import { colorHex } from "./palette";
import { GlowButton, NeutralButton } from "./GlowButton";
import { Avatar, NEUTRAL_RING } from "./Avatar";

/** One-shot confetti in the ink/kraft ramp, never the retired player palette: a win is a
 * platform moment, not a player-coloured one. Winner-only, so a draw never reads as a party. */
const CONFETTI_TONES = ["#e4b33c", "#d9ba88", "#f2ead9", "#b8683c"];

function Confetti() {
  const pieces = Array.from({ length: 44 }, (_, i) => {
    const x = (i * 37 + (i % 5) * 11) % 100;
    const wide = i % 3 === 0;
    return (
      <span
        key={i}
        style={{
          position: "absolute",
          top: 0,
          left: `${x}%`,
          width: wide ? 16 : 10,
          height: wide ? 8 : 18,
          background: CONFETTI_TONES[i % CONFETTI_TONES.length],
          borderRadius: 2,
          opacity: 0,
          animation: `hb-confetti-fall ${1.6 + (i % 7) * 0.18}s cubic-bezier(.3,.6,.5,1) ${(i % 11) * 0.07}s 1 forwards`,
        }}
      />
    );
  });
  return (
    <div className="hb-anim-confetti" style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      {pieces}
    </div>
  );
}

export type EndOfRoundWinner = {
  name: string;
  emoji: string;
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
  score: string;
};

export type EndOfRoundScreenProps = {
  gameName: string;
  roundLabel: string;
  roomCode: string;
  playerCount: number;
  /** null renders the neutral draw treatment: unlit chips, no medallion glow, no confetti. */
  winner: EndOfRoundWinner | null;
  /** Optional - some games (Tic-Tac-Toe) have no scores. */
  breakdown?: EndOfRoundBreakdownRow[];
  standings?: EndOfRoundStandingRow[];
  showActions: boolean;
  /** TV renders actions as non-interactive display affordances; phones drive them. */
  onRematch?: () => void;
  onBack?: () => void;
};

/** The medallion is the trophy and the only lit element on the screen. It is deliberately huge:
 * this is read from a couch, and the character IS the identity, so it earns the whole stage. */
function Medallion({ emoji }: { emoji: string }) {
  return (
    <div
      className="hb-anim-rank"
      style={{
        position: "relative",
        width: "calc(var(--u)*26)",
        height: "calc(var(--u)*26)",
        flex: "none",
        display: "grid",
        placeItems: "center",
        animation: "hb-rank-in 460ms cubic-bezier(.2,.8,.2,1) 1 both",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          background: "radial-gradient(circle at 50% 42%, rgba(228,179,60,.20) 0%, rgba(228,179,60,0) 68%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          border: "calc(var(--u)*.14) solid rgba(228,179,60,.55)",
          boxShadow: "0 0 calc(var(--u)*3.4) rgba(228,179,60,.28)",
        }}
      />
      <Avatar size="calc(var(--u)*21)" colorHex={NEUTRAL_RING} emoji={emoji} surface={2} />
    </div>
  );
}

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
            <div style={{ fontFamily: "var(--font-display)", fontSize: "calc(var(--u)*2.1)", letterSpacing: "0.02em" }}>
              HUB<span style={{ color: "var(--accent)" }}>BUB</span>
            </div>
            <div style={{ fontSize: "calc(var(--u)*1.5)", fontWeight: 600, color: "var(--text-secondary)" }}>
              {gameName} · {roundLabel}
            </div>
          </div>
          <div style={{ fontSize: "calc(var(--u)*1.4)", fontWeight: 500, color: "var(--text-faint)" }}>
            Room {roomCode} · {playerCount} players
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", gap: "calc(var(--u)*3.4)" }}>
          {winner ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "calc(var(--u)*1)" }}>
              <Medallion emoji={winner.emoji} />
              <div
                style={{
                  padding: "calc(var(--u)*.3) calc(var(--u)*1.1)",
                  borderRadius: 999,
                  background: "var(--accent)",
                  color: "var(--surface-0)",
                  fontFamily: "var(--font-display)",
                  fontSize: "calc(var(--u)*1.5)",
                  letterSpacing: "0.06em",
                }}
              >
                {winner.rankLabel}
                {winner.rankSuffix}
              </div>
            </div>
          ) : null}

          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "calc(var(--u)*.85)", maxWidth: "calc(var(--u)*40)" }}>
            <div style={{ fontSize: "calc(var(--u)*4.2)", fontWeight: 600, lineHeight: 1.05 }}>
              {winner ? winner.name : "It's a tie"}
            </div>
            <div style={{ height: 1, background: "var(--divider-heavy)" }} />
            {breakdown?.map((row) => (
              <div key={row.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "calc(var(--u)*.65) 0" }}>
                <span style={{ fontSize: "calc(var(--u)*1.6)", color: "var(--text-secondary)" }}>{row.label}</span>
                <span
                  style={{
                    fontSize: "calc(var(--u)*1.6)",
                    fontWeight: 600,
                    color: row.positive ? "var(--player-lime)" : "var(--text-faint)",
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
              <div style={{ fontSize: "calc(var(--u)*1.2)", fontWeight: 600, letterSpacing: "0.14em", color: "var(--text-faint)", marginBottom: "calc(var(--u)*.45)" }}>
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
                  <span style={{ fontSize: "calc(var(--u)*1.4)", fontWeight: 600, color: "var(--text-faint)", width: "calc(var(--u)*1.7)" }}>{row.position}</span>
                  {/* size 32 matches lobby/MiniIdentity's compact-row avatar */}
                  <Avatar size={32} colorHex={NEUTRAL_RING} emoji={row.emoji} surface={2} />
                  <span style={{ flex: 1, fontSize: "calc(var(--u)*1.4)", fontWeight: 500 }}>{row.name}</span>
                  <span style={{ fontSize: "calc(var(--u)*1.4)", fontWeight: 600, color: "var(--text-secondary)" }}>{row.score}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
