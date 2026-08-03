import type { CSSProperties } from "react";
import { AVATAR_SETS } from "@hubbub/ui";
import { BackHeader } from "./header";

// Track apps/controller/package.json's version field manually - no JSON import
// wired up for this app yet.
const APP_VERSION = "0.0.0";

export function AboutScreen({ onBack }: { onBack: () => void }) {
  return (
    <main style={page}>
      <BackHeader title="About" onBack={onBack} />
      <div style={body}>
        <div style={wordmark}>
          HUB<span style={{ color: "var(--accent)" }}>BUB</span>
        </div>
        <div style={version}>Version {APP_VERSION}</div>

        <div style={sectionLabel}>Third-party asset credits</div>
        {AVATAR_SETS.map((set) => (
          <div key={set.id} style={creditBlock}>
            <div style={creditName}>
              {set.name} <span style={creditLicence}>{set.licenseName}</span>
            </div>
            <div style={creditText}>{set.attribution}</div>
          </div>
        ))}
      </div>
    </main>
  );
}

const page: CSSProperties = { display: "flex", flexDirection: "column", height: "100dvh", background: "var(--surface-0)", color: "var(--text-primary)" };
const body: CSSProperties = { flex: 1, minHeight: 0, overflowY: "auto", padding: "24px 20px" };
const wordmark: CSSProperties = { font: "400 26px var(--font-display)", letterSpacing: "-0.01em" };
const version: CSSProperties = { marginTop: 4, font: "600 12px var(--font-ui)", color: "var(--text-muted)" };
const sectionLabel: CSSProperties = { marginTop: 28, font: "700 11px var(--font-ui)", letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--text-muted)" };
const creditBlock: CSSProperties = {
  marginTop: 10,
  padding: 14,
  borderRadius: "var(--radius-lg)",
  border: "1px solid var(--divider-heavy)",
  background: "rgba(242,234,217,.03)",
};
const creditName: CSSProperties = { font: "700 13px var(--font-ui)", color: "var(--text-primary)" };
const creditLicence: CSSProperties = { font: "600 10.5px var(--font-ui)", color: "var(--text-faint)" };
const creditText: CSSProperties = { marginTop: 4, font: "500 12px var(--font-ui)", lineHeight: 1.5, color: "var(--text-faint)" };
