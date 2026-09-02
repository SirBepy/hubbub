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
  avatarId: string;
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
  avatarId: string;
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

/** Tier heights by finishing position. Sized so the shortest still contains its rank numeral:
 * 3rd at 3.4u clears a 1.7u numeral plus its padding, measured in a browser, not computed. */
const TIER_HEIGHTS: Record<number, string> = {
  1: "calc(var(--u)*6.2)",
  2: "calc(var(--u)*4.4)",
  3: "calc(var(--u)*3.4)",
};

/** Best in the centre, the rest alternating outward, so the podium reads 2-1-3 left to right.
 * Tied players share a position and consume the places below, so two 2nds leaves no 3rd. */
export function podiumOrder(rows: EndOfRoundStandingRow[]): EndOfRoundStandingRow[] {
  const top = [...new Set(rows.map((r) => r.position))].sort((a, b) => a - b).slice(0, 3);
  const kept = rows.filter((r) => top.includes(r.position)).slice(0, 4);
  const out: EndOfRoundStandingRow[] = [];
  kept.forEach((row, i) => (i % 2 === 0 ? out.push(row) : out.unshift(row)));
  return out;
}

/** The medallion is the trophy and the only lit element on the screen. The winner's is deliberately
 * huge: this is read from a couch, and the character IS the identity, so it earns the whole stage.
 * Runners-up render the same shape unlit, keeping one glow per screen. */
function Medallion({ avatarId, first }: { avatarId: string; first: boolean }) {
  const size = first ? 13 : 8.4;
  return (
    <div
      className="hb-anim-rank"
      style={{
        position: "relative",
        width: `calc(var(--u)*${size})`,
        height: `calc(var(--u)*${size})`,
        flex: "none",
        display: "grid",
        placeItems: "center",
        animation: "hb-rank-in 460ms cubic-bezier(.2,.8,.2,1) 1 both",
      }}
    >
      {first ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            background: "radial-gradient(circle at 50% 42%, rgba(228,179,60,.20) 0%, rgba(228,179,60,0) 68%)",
          }}
        />
      ) : null}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          border: `calc(var(--u)*.14) solid ${first ? "rgba(228,179,60,.55)" : "rgba(242,234,217,.3)"}`,
          boxShadow: first ? "0 0 calc(var(--u)*2.6) rgba(228,179,60,.26)" : "none",
        }}
      />
      <Avatar size={`calc(var(--u)*${first ? 10.4 : 6.7})`} colorHex={NEUTRAL_RING} avatarId={avatarId} surface={2} />
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
  // A game with no ranking (Tic-Tac-Toe) supplies no standings, so the winner alone becomes a
  // one-slot podium rather than a second layout the screen has to switch between.
  const places = standings?.length
    ? podiumOrder(standings)
    : winner
      ? [{ position: 1, name: winner.name, avatarId: winner.avatarId, score: "" }]
      : [];

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

        {/* One subject, centred, owning the stage. The full table lives on each player's phone;
            this screen only has to say who won and in what order. */}
        <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {/* The ground line is what makes a tier read as standing on something rather than as a
              clipped box, and it is the only thing that holds up when there is a single place. */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: "calc(var(--u)*1.4)" }}>
            {places.map((place, i) => {
              const first = place.position === 1;
              return (
                <div key={`${place.position}-${place.name}-${i}`} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <Medallion avatarId={place.avatarId} first={first} />
                  <div
                    style={{
                      margin: "calc(var(--u)*.5) 0",
                      fontFamily: first ? "var(--font-display)" : undefined,
                      fontSize: first ? "calc(var(--u)*2.8)" : "calc(var(--u)*1.3)",
                      fontWeight: 600,
                    }}
                  >
                    {place.name}
                  </div>
                  <div
                    style={{
                      width: "calc(var(--u)*11.5)",
                      height: TIER_HEIGHTS[place.position] ?? TIER_HEIGHTS[3],
                      display: "flex",
                      alignItems: "baseline",
                      justifyContent: "center",
                      gap: "calc(var(--u)*.7)",
                      paddingTop: "calc(var(--u)*.75)",
                      background: first ? "rgba(228,179,60,.10)" : "var(--surface-1)",
                      border: `1px solid ${first ? "rgba(228,179,60,.34)" : "var(--divider)"}`,
                      borderBottom: "none",
                      borderRadius: "var(--radius-md) var(--radius-md) 0 0",
                    }}
                  >
                    <span style={{ fontFamily: "var(--font-display)", fontSize: "calc(var(--u)*1.7)", color: first ? "var(--accent)" : "var(--text-faint)" }}>
                      {place.position}
                    </span>
                    {place.score ? (
                      <span style={{ fontSize: "calc(var(--u)*1.3)", fontWeight: 600, color: first ? "var(--text-secondary)" : "var(--text-muted)" }}>
                        {place.score}
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ height: 1, width: "100%", background: "rgba(242,234,217,.22)" }} />
          </div>
        </div>

        {breakdown?.length ? (
          <div style={{ flex: "none", display: "flex", justifyContent: "center", gap: "calc(var(--u)*2.4)" }}>
            {breakdown.map((row) => (
              <span key={row.label} style={{ fontSize: "calc(var(--u)*1.2)", color: row.positive ? "var(--player-lime)" : "var(--text-muted)" }}>
                {row.label} <b style={{ color: "var(--text-secondary)" }}>{row.value}</b>
              </span>
            ))}
          </div>
        ) : null}

        {/* Only when a caller supplies a handler. The TV passes none, so the room sees no dead
            buttons and no empty strip reserving space for them; the live pair is on the phone. */}
        {showActions && (onRematch || onBack) ? (
          <div style={{ flex: "none", display: "flex", justifyContent: "center", gap: "calc(var(--u)*.85)", height: 64 }}>
            {onRematch ? <GlowButton colorHex={colorHex(1)} height={64} label="Rematch" onClick={onRematch} fullWidth={false} /> : null}
            {onBack ? <NeutralButton height={64} label="Back to lobby" onClick={onBack} fullWidth={false} /> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
