import type { CSSProperties } from "react";
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
        <div style={placeholder}>
          Credits are pending - the avatar artwork licence hasn't been finalized yet. This section will list attributions once it is.
        </div>
      </div>
    </main>
  );
}

const page: CSSProperties = { display: "flex", flexDirection: "column", height: "100dvh", background: "var(--surface-0)", color: "var(--text-primary)" };
const body: CSSProperties = { flex: 1, minHeight: 0, overflowY: "auto", padding: "24px 20px" };
const wordmark: CSSProperties = { font: "400 26px var(--font-display)", letterSpacing: "-0.01em" };
const version: CSSProperties = { marginTop: 4, font: "600 12px var(--font-ui)", color: "var(--text-muted)" };
const sectionLabel: CSSProperties = { marginTop: 28, font: "700 11px var(--font-ui)", letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--text-muted)" };
const placeholder: CSSProperties = {
  marginTop: 10,
  padding: 14,
  borderRadius: "var(--radius-lg)",
  border: "1px dashed var(--divider-heavy)",
  font: "500 13px var(--font-ui)",
  lineHeight: 1.5,
  color: "var(--text-faint)",
};
