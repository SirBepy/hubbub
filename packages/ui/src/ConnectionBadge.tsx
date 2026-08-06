import type { CSSProperties } from "react";
import { PLAYER_COLORS } from "./palette";

export interface ConnectionBadgeProps {
  tier: "direct" | "relay" | null; // null = still negotiating, renders nothing
  rttMs: number | null;
}

const DIRECT_HEX = PLAYER_COLORS[2].hex; // lime
const RELAY_HEX = PLAYER_COLORS[3].hex; // amber

/** Minimal indicator, not a feature screen (Phase E): a dot + label, nothing else. */
export function ConnectionBadge({ tier, rttMs }: ConnectionBadgeProps) {
  if (!tier) return null;
  const label = tier === "direct" ? "Direct" : "Relay";
  const suffix = rttMs !== null ? ` ${rttMs}ms` : "";
  return (
    <div style={wrap} title={`${label} connection${suffix}`}>
      <span style={{ ...dot, background: tier === "direct" ? DIRECT_HEX : RELAY_HEX }} />
      <span style={text}>
        {label}
        {suffix}
      </span>
    </div>
  );
}

const wrap: CSSProperties = { display: "flex", alignItems: "center", gap: 5, flex: "none" };
const dot: CSSProperties = { width: 6, height: 6, borderRadius: "50%", flex: "none" };
const text: CSSProperties = { font: "600 10px var(--font-ui)", color: "var(--text-faint)", letterSpacing: "0.02em", whiteSpace: "nowrap" };
