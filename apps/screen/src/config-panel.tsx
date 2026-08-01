import type { SettingsField } from "@hubbub/sdk";

// Platform-owned pre-game config panel (mode "configuring") - follows lobby.tsx's header/cursor-
// highlight styling. Read-only: all input happens on the host's phone remote (config-remote.tsx).
export function ConfigPanel({
  code,
  gameName,
  fields,
  values,
  cursorIndex,
}: {
  code: string;
  gameName: string;
  fields: SettingsField[];
  values: Record<string, string>;
  cursorIndex: number;
}) {
  return (
    <div style={{ width: 1920, height: 1080, display: "flex", flexDirection: "column", color: "var(--text-primary)" }}>
      <div
        style={{
          height: 56, flex: "none", padding: "0 48px",
          borderBottom: "1px solid var(--divider)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}
      >
        <div style={{ font: "700 34px var(--font-display)", letterSpacing: "0.03em" }}>HUBBUB</div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ font: "400 22px var(--font-ui)", color: "var(--text-muted)" }}>room</span>
          <span style={{ font: "700 40px var(--font-display)", letterSpacing: "0.08em" }}>{code || "…"}</span>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 32 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <span style={{ font: "500 22px var(--font-ui)", letterSpacing: "0.14em", color: "var(--text-muted)" }}>CONFIGURE</span>
          <span style={{ font: "700 56px var(--font-display)", letterSpacing: "0.03em" }}>{gameName}</span>
        </div>

        <div style={{ width: 760, display: "flex", flexDirection: "column", gap: 12 }}>
          {fields.map((f, i) => {
            const focused = i === cursorIndex;
            const value = values[f.key] ?? f.default;
            const display = f.type === "choice" ? f.options?.find((o) => o.value === value)?.label ?? value : value || f.placeholder || "...";
            return (
              <div
                key={f.key}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "18px 28px", borderRadius: "var(--radius-md)",
                  background: focused ? "rgba(145,132,217,.10)" : "var(--surface-1)",
                  border: focused ? "1px solid var(--accent)" : "1px solid var(--divider)",
                }}
              >
                <span style={{ font: "600 26px var(--font-ui)" }}>{f.label}</span>
                <span style={{ font: "500 26px var(--font-ui)", color: focused ? "var(--text-primary)" : "var(--text-muted)" }}>{display}</span>
              </div>
            );
          })}
        </div>

        <span style={{ font: "500 20px var(--font-ui)", color: "var(--text-faint)" }}>Use the host's phone to adjust - START to begin</span>
      </div>
    </div>
  );
}
