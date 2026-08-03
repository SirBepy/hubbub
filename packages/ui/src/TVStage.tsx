import type { ReactNode } from "react";

/**
 * Fluid full-viewport TV container: felt ground gradient + dot texture, sets
 * up the flex column every TV screen renders into. No fixed canvas/scale —
 * screens size off the --u custom property (see styles.css) instead.
 */
export function TVStage({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        position: "relative",
        width: "100vw",
        height: "100dvh",
        overflow: "hidden",
        background:
          "radial-gradient(120% 92% at 32% -6%, var(--surface-2) 0%, var(--surface-1) 46%, var(--surface-0) 100%)",
        color: "var(--text-primary)",
        fontFamily: "var(--font-ui)",
      }}
    >
      <div className="hb-felt" />
      <div
        style={{
          position: "relative",
          zIndex: 2,
          height: "100%",
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {children}
      </div>
    </div>
  );
}
