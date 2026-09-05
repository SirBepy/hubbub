import { useEffect, type ReactNode } from "react";
import type { InputLegendEntry } from "@hubbub/sdk/input";
import { sfx } from "@hubbub/sdk/sfx";
import { InputLegendTray } from "./InputLegendTray";
import { SoundToggle } from "./SoundToggle";

/**
 * Fluid full-viewport TV container: felt ground gradient + dot texture, sets
 * up the flex column every TV screen renders into. No fixed canvas/scale -
 * screens size off the --u custom property (see styles.css) instead.
 *
 * The input legend hangs here rather than on each screen, so every TV surface picks it up at
 * once and none of them hardcodes a per-screen string.
 */
export function TVStage({ children, inputLegend }: { children: ReactNode; inputLegend?: InputLegendEntry[] }) {
  // Any click or key on the TV page counts as the user gesture Chrome's autoplay policy wants -
  // wiring it once here means no individual screen has to remember to unlock sound itself.
  useEffect(() => sfx.installAutoUnlock(), []);

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
        <InputLegendTray entries={inputLegend ?? []} />
        <SoundToggle />
      </div>
    </div>
  );
}
