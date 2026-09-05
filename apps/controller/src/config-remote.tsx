import type { CSSProperties } from "react";
import { CaretUp, CaretDown, CaretLeft, CaretRight } from "@phosphor-icons/react";
import { GlowButton, NeutralButton, colorHex } from "@hubbub/ui";
import type { SettingsField } from "@hubbub/sdk";

// Host's phone becomes a remote for the platform's TV config panel (screen/config-panel.tsx).
// Non-host phones just wait - only the host's up/down/left/right messages are server-honored.
export function ConfigRemote({
  gameName,
  fields,
  values,
  cursorIndex,
  isHost,
  error,
  onCursor,
  onAdjust,
  onSet,
  onConfirm,
  onCancel,
}: {
  gameName: string;
  fields: SettingsField[];
  values: Record<string, string>;
  cursorIndex: number;
  isHost: boolean;
  error?: string;
  onCursor: (dir: "up" | "down") => void;
  onAdjust: (field: string, dir: "left" | "right") => void;
  onSet: (field: string, value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!isHost) {
    return (
      <main className="hb-anim-deal" style={page}>
        <div style={waiting}>
          <div style={waitingTitle}>Configuring {gameName}</div>
          <div style={waitingSub}>Watch the TV - the host is setting things up</div>
        </div>
      </main>
    );
  }

  const field = fields[cursorIndex] ?? null;

  return (
    <main className="hb-anim-deal" style={page}>
      <div style={header}>
        <span style={headerTitle}>{gameName} settings</span>
      </div>

      {error ? <div style={errorBanner}>{error}</div> : null}

      {field ? (
        <div style={body}>
          <div style={fieldLabel}>{field.label}</div>
          {field.type === "text" ? (
            <input
              value={values[field.key] ?? ""}
              onChange={(e) => onSet(field.key, e.target.value)}
              placeholder={field.placeholder}
              style={textInput}
            />
          ) : (
            <div style={valueRow}>
              <button type="button" aria-label="Previous" onClick={() => onAdjust(field.key, "left")} style={dpadButton}>
                <CaretLeft size={24} weight="bold" />
              </button>
              <span style={valueLabel}>{field.options?.find((o) => o.value === values[field.key])?.label ?? values[field.key]}</span>
              <button type="button" aria-label="Next" onClick={() => onAdjust(field.key, "right")} style={dpadButton}>
                <CaretRight size={24} weight="bold" />
              </button>
            </div>
          )}

          <div style={cursorRow}>
            <button type="button" aria-label="Field up" onClick={() => onCursor("up")} disabled={cursorIndex === 0} style={dpadButton}>
              <CaretUp size={24} weight="bold" />
            </button>
            <span style={cursorHint}>
              {cursorIndex + 1} / {fields.length}
            </span>
            <button type="button" aria-label="Field down" onClick={() => onCursor("down")} disabled={cursorIndex === fields.length - 1} style={dpadButton}>
              <CaretDown size={24} weight="bold" />
            </button>
          </div>
        </div>
      ) : null}

      <div style={footer}>
        <NeutralButton height={56} label="Back" onClick={onCancel} fullWidth={false} />
        <div style={{ flex: 1 }}>
          <GlowButton colorHex={colorHex(1)} height={56} label="Start" onClick={onConfirm} />
        </div>
      </div>
    </main>
  );
}

const page: CSSProperties = { display: "flex", flexDirection: "column", height: "100dvh", background: "var(--surface-0)", color: "var(--text-primary)" };
const header: CSSProperties = { flex: "none", height: 44, padding: "0 16px", display: "flex", alignItems: "center" };
const headerTitle: CSSProperties = { font: "600 16px var(--font-ui)" };
const errorBanner: CSSProperties = {
  margin: "0 16px 12px", padding: "10px 12px", borderRadius: "var(--radius-md)",
  background: "rgba(255,61,154,.12)", border: "1px solid var(--player-magenta)",
  color: "var(--player-magenta)", font: "500 13px var(--font-ui)",
};
const body: CSSProperties = { flex: 1, minHeight: 0, padding: "8px 16px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 28 };
const fieldLabel: CSSProperties = { font: "600 13px var(--font-ui)", letterSpacing: "0.12em", color: "var(--text-muted)", textTransform: "uppercase" };
const textInput: CSSProperties = {
  width: "100%", height: 48, padding: "0 12px", background: "var(--surface-1)", border: "1px solid var(--divider)",
  borderRadius: "var(--radius-md)", color: "var(--text-primary)", font: "500 15px var(--font-ui)", textAlign: "center",
};
const valueRow: CSSProperties = { display: "flex", alignItems: "center", gap: 20 };
const valueLabel: CSSProperties = { minWidth: 140, textAlign: "center", font: "700 22px var(--font-ui)" };
const cursorRow: CSSProperties = { display: "flex", alignItems: "center", gap: 16 };
const cursorHint: CSSProperties = { font: "500 13px var(--font-ui)", color: "var(--text-faint)", minWidth: 40, textAlign: "center" };
const dpadButton: CSSProperties = {
  width: 56, height: 56, display: "flex", alignItems: "center", justifyContent: "center",
  borderRadius: "var(--radius-md)", background: "var(--surface-1)", border: "1px solid var(--divider)",
  color: "var(--text-primary)", cursor: "pointer",
};
const footer: CSSProperties = { flex: "none", padding: 16, borderTop: "1px solid var(--divider)", display: "flex", gap: 8 };
const waiting: CSSProperties = { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, padding: 24, textAlign: "center" };
const waitingTitle: CSSProperties = { font: "600 18px var(--font-ui)" };
const waitingSub: CSSProperties = { font: "500 13px var(--font-ui)", color: "var(--text-muted)" };
