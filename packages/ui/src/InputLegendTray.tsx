import type { CSSProperties } from "react";
import type { InputLegendEntry } from "@hubbub/sdk/input";

/**
 * Minecraft-style bottom strip saying what the attached gamepad's buttons do right now. It only
 * exists when a physical controller is bound, so a phones-only room never sees it: telling
 * someone "phone: rematch" is noise when the phone is already in their hand showing the button.
 */
export function InputLegendTray({ entries }: { entries: InputLegendEntry[] }) {
  if (!entries.length) return null;
  return (
    <div style={tray}>
      {entries.map((entry) => (
        <span key={`${entry.glyph}-${entry.label}`} style={item}>
          <span style={glyph}>{entry.glyph}</span>
          <span style={label}>{entry.label}</span>
        </span>
      ))}
    </div>
  );
}

const tray: CSSProperties = {
  flex: "none",
  display: "flex",
  justifyContent: "center",
  gap: "calc(var(--u)*1.6)",
  padding: "calc(var(--u)*.42) calc(var(--u)*1.2)",
  background: "rgba(12,9,5,.62)",
  borderTop: "1px solid var(--divider)",
};
const item: CSSProperties = { display: "flex", alignItems: "center", gap: "calc(var(--u)*.42)" };
// A ring rather than a filled chip: the tray is a caption, and one glow per screen is spent
// elsewhere. Square-ish min sizing keeps A and Y the same width.
const glyph: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: "calc(var(--u)*1.15)",
  height: "calc(var(--u)*1.15)",
  padding: "0 calc(var(--u)*.22)",
  borderRadius: "calc(var(--u)*.28)",
  border: "1px solid var(--text-muted)",
  fontFamily: "var(--font-display)",
  fontSize: "calc(var(--u)*.72)",
  lineHeight: 1,
  color: "var(--text-secondary)",
};
const label: CSSProperties = {
  fontSize: "calc(var(--u)*.66)",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--text-muted)",
};
