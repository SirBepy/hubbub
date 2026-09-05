import { useState, type CSSProperties } from "react";
import { App as ScreenApp } from "@hubbub/screen";
import {
  decideInitialRole,
  getRoomCodeFromSearch,
  getStoredRoleOverride,
  setStoredRoleOverride,
  type Role,
} from "./role";
import { ControllerEntry } from "./controller-entry";

const roomCode = getRoomCodeFromSearch(location.search);

export function App() {
  const [role, setRole] = useState<Role>(() =>
    decideInitialRole({
      roomCode,
      storedOverride: getStoredRoleOverride(),
      coarsePointer: matchMedia("(pointer: coarse)").matches,
      viewportWidth: window.innerWidth,
    }),
  );

  function switchRole() {
    const next: Role = role === "screen" ? "controller" : "screen";
    setStoredRoleOverride(next);
    setRole(next);
  }

  // key remounts the whole role tree, so the old role's effects (websocket, timers)
  // tear down cleanly instead of leaking into the new role.
  if (role === "screen") {
    return (
      <>
        <ScreenApp key="screen" />
        <button type="button" onClick={switchRole} style={switcherStyle}>
          Join instead
        </button>
      </>
    );
  }

  return <ControllerEntry key="controller" onHostInstead={switchRole} />;
}

// Mirrors join.tsx's "Host instead": plain muted text, no fill/border/glow.
// Corner-anchored, not centred, since nothing on the hero anchors it like the phone's CTA does.
// Sits one 44px control above the corner: TVStage's sound pill owns the corner itself.
const switcherStyle: CSSProperties = {
  position: "fixed",
  bottom: "calc(var(--u) * 1.6 + 44px)",
  right: "calc(var(--u) * 1)",
  zIndex: 9999,
  background: "none",
  border: "none",
  padding: "calc(var(--u) * .55) calc(var(--u) * .85)",
  font: "500 calc(var(--u) * .85) var(--font-ui)",
  color: "var(--text-muted)",
  cursor: "pointer",
};
