import type { CSSProperties } from "react";
import { BackHeader } from "./header";

const STEPS = [
  "Vote for games you want to play, or search the full list.",
  "The host picks what starts - the TV shows what's happening.",
  "Your phone is the controller. Keep your eyes on the TV; it shows everything that matters.",
];

export function HowToPlayScreen({ onBack }: { onBack: () => void }) {
  return (
    <main style={page}>
      <BackHeader title="How to play" onBack={onBack} />
      <div style={body}>
        {STEPS.map((text, i) => (
          <div key={text} style={step}>
            <span style={num}>{i + 1}</span>
            <p style={text_}>{text}</p>
          </div>
        ))}
      </div>
    </main>
  );
}

const page: CSSProperties = { display: "flex", flexDirection: "column", height: "100dvh", background: "var(--surface-0)", color: "var(--text-primary)" };
const body: CSSProperties = { flex: 1, minHeight: 0, overflowY: "auto", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 16 };
const step: CSSProperties = { display: "flex", gap: 14, alignItems: "flex-start" };
const num: CSSProperties = {
  flex: "none",
  width: 28,
  height: 28,
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(247,207,99,.13)",
  color: "var(--ink-amber-highlight)",
  font: "700 13px var(--font-ui)",
};
const text_: CSSProperties = { margin: 0, font: "500 14.5px var(--font-ui)", lineHeight: 1.5, color: "var(--text-secondary)" };
