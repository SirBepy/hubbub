import type { CSSProperties, ReactNode } from "react";
import { colorHex } from "@hubbub/ui";

/** One game list row - shared shell for lobby and search, which each supply their
 * own meta line and vote badge (the two screens use different vote semantics). */
export function GameRow({
  game,
  meta,
  badge,
  highlight,
  onClick,
}: {
  game: { id: string; name: string; identityColors?: [number, number] };
  meta: ReactNode;
  badge: ReactNode;
  highlight?: "tv" | "mine";
  onClick: () => void;
}) {
  const [c1, c2] = game.identityColors ?? [1, 0];
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...row,
        ...(highlight === "tv" ? tvRow : highlight === "mine" ? mineRow : null),
      }}
    >
      <span style={{ ...art, background: `linear-gradient(160deg, ${colorHex(c1)}, ${colorHex(c2)})` }} />
      <span style={body}>
        <b style={title}>{game.name}</b>
        <span style={metaLine}>{meta}</span>
      </span>
      {badge}
    </button>
  );
}

/** Count + label pill. Caller decides count/label/active per its own vote rules. Keyed on its
 * own count so a fresh vote arriving re-mounts the pill and replays the pop rather than only
 * doing so the first time this row's badge ever appears. */
export function VoteBadge({ count, active, label }: { count: number | string; active: boolean; label: string }) {
  return (
    <span key={count} className="hb-anim-pop" style={{ ...badge, ...(active ? badgeOn : null) }}>
      <b style={badgeCount}>{count}</b>
      {label}
    </span>
  );
}

const row: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 11,
  padding: "10px 11px",
  borderRadius: "var(--radius-lg)",
  background: "rgba(242,234,217,.045)",
  border: "1px solid var(--divider)",
  textAlign: "left",
  cursor: "pointer",
};
const tvRow: CSSProperties = { borderColor: "var(--ink-amber-highlight)", boxShadow: "0 0 0 1px var(--ink-amber-highlight) inset" };
const mineRow: CSSProperties = { borderColor: "rgba(247,207,99,.4)", background: "rgba(247,207,99,.07)" };
const art: CSSProperties = { flex: "none", width: 42, height: 50, borderRadius: 6, boxShadow: "inset 0 2px 0 rgba(255,255,255,.2), 0 4px 9px rgba(0,0,0,.45)" };
const body: CSSProperties = { flex: 1, minWidth: 0, display: "flex", flexDirection: "column" };
const title: CSSProperties = { font: "400 15px var(--font-display)", lineHeight: 1.15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
const metaLine: CSSProperties = {
  marginTop: 3,
  font: "600 11.5px var(--font-ui)",
  lineHeight: 1.35,
  color: "var(--text-muted)",
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
};
const badge: CSSProperties = {
  flex: "none",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 1,
  minWidth: 50,
  padding: "6px 8px",
  borderRadius: "var(--radius-md)",
  border: "2px solid var(--divider-heavy)",
  color: "var(--text-secondary)",
  font: "700 9px var(--font-ui)",
  letterSpacing: "0.1em",
};
const badgeOn: CSSProperties = { borderColor: "var(--ink-amber-highlight)", background: "rgba(247,207,99,.16)", color: "var(--ink-amber-highlight)" };
const badgeCount: CSSProperties = { font: "400 16px var(--font-display)", lineHeight: 1 };
