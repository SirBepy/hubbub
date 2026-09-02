import type { SettingsField } from "@hubbub/sdk";
import { hostLabelFontScale } from "@hubbub/ui";

// Platform-owned pre-game config panel (mode "configuring"). No dedicated mockup exists for
// this screen - derived from the lobby's kraft-chit/hero treatment and the a6 top-bar chit,
// not a separately approved design. Read-only: input happens on the host's phone remote.
export function ConfigPanel({
  code,
  hostLabel,
  gameName,
  fields,
  values,
  cursorIndex,
  setupError,
}: {
  code: string;
  hostLabel: string;
  gameName: string;
  fields: SettingsField[];
  values: Record<string, string>;
  cursorIndex: number;
  setupError?: string;
}) {
  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", color: "var(--text-primary)" }}>
      <div
        style={{
          flex: "none", display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: "calc(var(--u)*1.2)", padding: "calc(var(--u)*.5) calc(var(--u)*1.4)", minWidth: 0,
          background: "linear-gradient(180deg,#241d15,#161109)", borderBottom: "calc(var(--u)*.12) solid var(--accent)",
        }}
      >
        <div style={{ fontFamily: "var(--font-display)", fontSize: "calc(var(--u)*1.3)", lineHeight: 0.9, letterSpacing: "-0.02em", color: "#f7f1e2" }}>
          HUB<span style={{ color: "var(--accent)" }}>BUB</span>
        </div>
        <div
          style={{
            flex: "none", textAlign: "center", padding: "calc(var(--u)*.2) calc(var(--u)*.7) calc(var(--u)*.32)",
            borderRadius: "calc(var(--u)*.28)", background: "linear-gradient(180deg,var(--kraft-light),var(--kraft-dark))",
            boxShadow: "0 2px 0 #7d6242, inset 0 1px 0 rgba(255,255,255,.4)",
          }}
        >
          <div style={{ fontFamily: "var(--font-display)", fontSize: "calc(var(--u)*1.3)", lineHeight: 1, letterSpacing: "0.08em", color: "var(--kraft-ink)" }}>
            {code || "…"}
          </div>
          <div
            style={{
              fontSize: `calc(var(--u)*.56*${hostLabelFontScale(hostLabel)})`, fontWeight: 700, letterSpacing: "0.1em", color: "var(--kraft-ink-mid)",
              maxWidth: "calc(var(--u)*7.4)", whiteSpace: "nowrap", overflow: "hidden",
            }}
          >
            {hostLabel}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "calc(var(--u)*1.6)" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "calc(var(--u)*.4)" }}>
          <span style={{ fontSize: "calc(var(--u)*.8)", letterSpacing: "0.3em", fontWeight: 700, color: "var(--accent)", textTransform: "uppercase" }}>
            Configure
          </span>
          <span style={{ fontFamily: "var(--font-display)", fontSize: "calc(var(--u)*2.6)", letterSpacing: "-0.02em", color: "#f7f1e2" }}>{gameName}</span>
        </div>

        <div style={{ width: "calc(var(--u)*38)", maxWidth: "90%", display: "flex", flexDirection: "column", gap: "calc(var(--u)*.55)" }}>
          {fields.map((f, i) => {
            const focused = i === cursorIndex;
            const value = values[f.key] ?? f.default;
            const display = f.type === "choice" ? f.options?.find((o) => o.value === value)?.label ?? value : value || f.placeholder || "...";
            return (
              <div
                key={f.key}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "calc(var(--u)*.6) calc(var(--u)*.9)", borderRadius: "calc(var(--u)*.35)",
                  background: focused ? "rgba(247,207,99,.1)" : "rgba(242,234,217,.05)",
                  border: focused ? "1px solid var(--ink-amber-highlight)" : "1px solid rgba(242,234,217,.12)",
                  boxShadow: focused ? "0 0 calc(var(--u)*1.2) rgba(247,207,99,.22)" : "none",
                }}
              >
                <span style={{ fontSize: "calc(var(--u)*.92)", fontWeight: 600 }}>{f.label}</span>
                <span style={{ fontSize: "calc(var(--u)*.92)", fontWeight: 500, color: focused ? "var(--text-primary)" : "var(--text-muted)" }}>{display}</span>
              </div>
            );
          })}
        </div>

        {setupError ? (
          <div
            role="alert"
            style={{
              width: "calc(var(--u)*38)", maxWidth: "90%", display: "flex", flexDirection: "column",
              alignItems: "center", gap: "calc(var(--u)*.35)", textAlign: "center",
              padding: "calc(var(--u)*.9) calc(var(--u)*1.1)", borderRadius: "calc(var(--u)*.35)",
              background: "rgba(190,60,50,.14)", border: "1px solid rgba(226,110,96,.5)",
            }}
          >
            <span style={{ fontSize: "calc(var(--u)*.72)", letterSpacing: "0.3em", fontWeight: 700, color: "#e26e60", textTransform: "uppercase" }}>
              Can't start
            </span>
            {/* The game authors this string; the platform only carries it. Sized to the field
                rows above so it is readable from three metres on an uncalibrated TV. */}
            <span style={{ fontSize: "calc(var(--u)*.92)", fontWeight: 600, lineHeight: 1.3 }}>{setupError}</span>
            <span style={{ fontSize: "calc(var(--u)*.72)", color: "var(--text-faint)" }}>Fix it and press START again, or back out to pick another game</span>
          </div>
        ) : (
          <span style={{ fontSize: "calc(var(--u)*.72)", color: "var(--text-faint)" }}>Use the host's phone to adjust - START to begin</span>
        )}
      </div>
    </div>
  );
}
