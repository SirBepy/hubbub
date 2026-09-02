import type { DisplayPlayer, GameResultStanding } from "@hubbub/sdk";
import { Avatar, NEUTRAL_RING } from "@hubbub/ui";

/** The full table the TV deliberately drops. Held rather than glanced, so it can be dense and
 * small in a way the three-metre screen never can. Your own row is the one thing emphasised. */
export function Scoreboard({
  standings,
  players,
  meId,
}: {
  standings: GameResultStanding[];
  players: DisplayPlayer[];
  meId: string | null;
}) {
  const rows = standings
    .map((s) => ({ ...s, player: players.find((p) => p.id === s.playerId) ?? null }))
    .filter((r) => r.player !== null);
  if (rows.length === 0) return null;

  return (
    <section style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 6 }}>
      <h2 style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.18em", color: "var(--text-faint)", textTransform: "uppercase" }}>
        Scoreboard
      </h2>
      {rows.map((row, i) => {
        const mine = row.playerId === meId;
        return (
          <div
            key={`${row.playerId}-${i}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 10px",
              borderRadius: "var(--radius-md)",
              background: mine ? "rgba(228,179,60,.12)" : "var(--surface-1)",
              border: `1px solid ${mine ? "rgba(228,179,60,.4)" : "var(--divider)"}`,
            }}
          >
            <span style={{ width: 20, fontSize: 15, fontWeight: 700, color: mine ? "var(--accent)" : "var(--text-faint)" }}>
              {row.position}
            </span>
            <Avatar size={28} colorHex={NEUTRAL_RING} avatarId={row.player!.avatarId} surface={2} />
            <span style={{ flex: 1, fontSize: 15, fontWeight: mine ? 700 : 500 }}>{row.player!.name}</span>
            {row.score == null ? null : (
              <span style={{ fontSize: 15, fontWeight: 600, color: "var(--text-secondary)" }}>{row.score}</span>
            )}
          </div>
        );
      })}
    </section>
  );
}
