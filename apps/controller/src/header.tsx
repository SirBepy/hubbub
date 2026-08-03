import type { CSSProperties } from "react";
import { CaretLeft } from "@phosphor-icons/react";
import { Avatar } from "@hubbub/ui";

// Players carry no colour in this app; identity is the character alone. The Avatar
// component still takes a ring colour, so every avatar gets the same neutral one.
export const NEUTRAL_RING = "rgba(242,234,217,.35)";

/** Pinned identity bar. Tapping the avatar/name opens the menu - deliberately
 * undressed (no pill, border or caret) so it doesn't read as a control. */
export function IdentityHeader({
  name,
  emoji,
  isHost,
  onOpenMenu,
}: {
  name: string;
  emoji: string;
  isHost: boolean;
  onOpenMenu: () => void;
}) {
  return (
    <div style={bar}>
      <button type="button" onClick={onOpenMenu} style={meButton}>
        <Avatar size={34} colorHex={NEUTRAL_RING} emoji={emoji} surface={1} />
        <span style={meName}>{name}</span>
        {isHost ? <span style={hostTag}>HOST</span> : null}
      </button>
    </div>
  );
}

/** Back-caret + centered title, used by every drill-down sub-screen. */
export function BackHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div style={bar}>
      <button type="button" onClick={onBack} aria-label="Back" style={iconButton}>
        <CaretLeft size={18} weight="bold" />
      </button>
      <span style={centerTitle}>{title}</span>
      <span style={spacer} />
    </div>
  );
}

const bar: CSSProperties = {
  flex: "none",
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "12px 14px",
  background: "rgba(18,14,9,.9)",
  borderBottom: "1px solid var(--divider)",
};
const meButton: CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: "flex",
  alignItems: "center",
  gap: 9,
  background: "transparent",
  border: "none",
  padding: 0,
  cursor: "pointer",
  textAlign: "left",
};
const meName: CSSProperties = {
  font: "700 16px var(--font-display)",
  lineHeight: 1,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  color: "var(--text-primary)",
};
const hostTag: CSSProperties = {
  flex: "none",
  font: "700 9px var(--font-ui)",
  letterSpacing: "0.14em",
  color: "#2A1A08",
  background: "var(--accent)",
  borderRadius: 3,
  padding: "2px 5px",
};
const iconButton: CSSProperties = {
  flex: "none",
  width: 34,
  height: 34,
  borderRadius: 9,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(242,234,217,.06)",
  border: "1px solid var(--divider-heavy)",
  color: "rgba(242,234,217,.72)",
  cursor: "pointer",
};
const centerTitle: CSSProperties = { flex: 1, font: "700 16px var(--font-display)", textAlign: "center" };
const spacer: CSSProperties = { flex: "none", width: 34 };
