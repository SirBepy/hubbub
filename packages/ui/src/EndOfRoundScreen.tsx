import { useEffect, useState, type CSSProperties } from "react";
import { sfx } from "@hubbub/sdk/sfx";
import { colorHex } from "./palette";
import { GlowButton, NeutralButton } from "./GlowButton";
import { Avatar, NEUTRAL_RING } from "./Avatar";

function reducedMotion(): boolean {
  return typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** One-shot confetti in the ink/kraft ramp, never the retired player palette: a win is a
 * platform moment, not a player-coloured one. Winner-only, so a draw never reads as a party. */
const CONFETTI_TONES = ["#e4b33c", "#d9ba88", "#f2ead9", "#b8683c"];

/** startDelayMs pushes every piece's existing per-piece stagger out by the same amount, so
 * confetti starts falling at the winner's medallion beat instead of at screen mount - pieces
 * simply sit at their base opacity:0 until their (now later) animation-delay arrives. */
function Confetti({ startDelayMs }: { startDelayMs: number }) {
  const pieces = Array.from({ length: 44 }, (_, i) => {
    const x = (i * 37 + (i % 5) * 11) % 100;
    const wide = i % 3 === 0;
    const delayS = (i % 11) * 0.07 + startDelayMs / 1000;
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
          animation: `hb-confetti-fall ${1.6 + (i % 7) * 0.18}s cubic-bezier(.3,.6,.5,1) ${delayS}s 1 forwards`,
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

/** rAF-driven ease-out count, held at 0 until startDelayMs so a tier's score visibly climbs
 * only once its own medallion has landed, not all at once with the rest of the screen. */
function useCountUp(target: number, startDelayMs: number, durationMs = 600): number {
  const [value, setValue] = useState(() => (reducedMotion() ? target : 0));

  useEffect(() => {
    if (reducedMotion() || !Number.isFinite(target)) {
      setValue(target);
      return;
    }
    let raf = 0;
    const startedAt = performance.now() + startDelayMs;
    const tick = (now: number) => {
      const elapsed = now - startedAt;
      if (elapsed < 0) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const t = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, startDelayMs, durationMs]);

  return value;
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

/** Gap between each medallion's pop in the 3rd -> 2nd -> 1st reveal sequence. Expressed through
 * .hb-anim-pop's own --i * 90ms formula (see styles.css) rather than an inline override, so the
 * timing stays declared in one place. */
const POP_STEP_MS = 350;
const POP_DURATION_MS = 320;

/** The medallion is the trophy and the only lit element on the screen. The winner's is deliberately
 * huge: this is read from a couch, and the character IS the identity, so it earns the whole stage.
 * Runners-up render the same shape unlit, keeping one glow per screen.
 *
 * popIndex is the position in the 3rd -> 2nd -> 1st reveal order, not DOM order, so the podium's
 * centred layout (2-1-3) doesn't dictate which medallion pops first. pulseDelayMs is set only on
 * the winner, for the extra emphasis once its own pop has landed. */
function Medallion({
  avatarId,
  first,
  popIndex,
  pulseDelayMs,
}: {
  avatarId: string;
  first: boolean;
  popIndex: number;
  pulseDelayMs?: number;
}) {
  const size = first ? 13 : 8.4;
  const content = (
    <>
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
    </>
  );
  return (
    <div
      className="hb-anim-pop"
      style={
        {
          position: "relative",
          width: `calc(var(--u)*${size})`,
          height: `calc(var(--u)*${size})`,
          flex: "none",
          display: "grid",
          placeItems: "center",
          // .hb-anim-pop reads --i in units of 90ms; scaling popIndex keeps the sequence's real
          // 350ms gap while still going through that single declared step size.
          "--i": (popIndex * POP_STEP_MS) / 90,
        } as CSSProperties
      }
    >
      {pulseDelayMs != null ? (
        <div
          className="hb-anim-pulse"
          style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", animationDelay: `${pulseDelayMs}ms` }}
        >
          {content}
        </div>
      ) : (
        content
      )}
    </div>
  );
}

/** Podium score, counting up once its own medallion lands rather than all together with the
 * rest of the screen - a non-numeric or empty score (games with no ranking) renders as-is. */
function TierScore({ score, first, landAtMs }: { score: string; first: boolean; landAtMs: number }) {
  const target = Number(score);
  const animated = score !== "" && Number.isFinite(target);
  const value = useCountUp(animated ? target : 0, landAtMs + 100);
  if (!score) return null;
  return (
    <span style={{ fontSize: "calc(var(--u)*1.3)", fontWeight: 600, color: first ? "var(--text-secondary)" : "var(--text-muted)" }}>
      {animated ? value : score}
    </span>
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

  // Reveal order is worst-to-best (3rd -> 2nd -> 1st), independent of the podium's 2-1-3 layout
  // order above. Array.prototype.sort is stable, so tied positions keep their podiumOrder spot.
  const popOrder = [...places].sort((a, b) => b.position - a.position);
  const winnerOrderIndex = winner ? popOrder.length - 1 : -1;
  const winnerLandAt = winnerOrderIndex >= 0 ? winnerOrderIndex * POP_STEP_MS + POP_DURATION_MS : 0;

  // Choreography plays once at mount - a new result is always a fresh mount (the parent branches
  // between the game view and this screen), so an empty dep array is the whole lifecycle, not a
  // stale closure risk.
  useEffect(() => {
    const instant = reducedMotion();
    sfx.play("reveal");
    popOrder.forEach((place, orderIndex) => {
      sfx.play("pop", { index: orderIndex, delayMs: instant ? 0 : orderIndex * POP_STEP_MS });
    });
    if (popOrder.length) {
      const lastOrderIndex = popOrder.length - 1;
      const landAt = lastOrderIndex * POP_STEP_MS + POP_DURATION_MS;
      if (winner) {
        sfx.play("fanfare", { delayMs: instant ? 0 : landAt + 200 });
      } else {
        // A draw still builds the same podium (a tie can fill every place) but earns no fanfare.
        sfx.play("wrong", { gain: 0.3, delayMs: instant ? 0 : landAt + 200 });
      }
    }
  }, []);

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
      {winner ? <Confetti startDelayMs={winnerLandAt + 200} /> : null}
      <div
        className="hb-anim-deal"
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
              const orderIndex = popOrder.indexOf(place);
              const landAtMs = orderIndex * POP_STEP_MS + POP_DURATION_MS;
              const pulseDelayMs = winner && first ? winnerLandAt + 200 : undefined;
              return (
                <div key={`${place.position}-${place.name}-${i}`} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <Medallion avatarId={place.avatarId} first={first} popIndex={orderIndex} pulseDelayMs={pulseDelayMs} />
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
                    <TierScore score={place.score} first={first} landAtMs={landAtMs} />
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
            {/* The non-podium detail row: staggered in reverse index so it reads as filling in
                from its last item first, distinct from the podium's own reveal order above it. */}
            {breakdown.map((row, i) => (
              <span
                key={row.label}
                className="hb-anim-deal"
                style={
                  {
                    fontSize: "calc(var(--u)*1.2)",
                    color: row.positive ? "var(--player-lime)" : "var(--text-muted)",
                    "--i": breakdown.length - 1 - i,
                  } as CSSProperties
                }
              >
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
