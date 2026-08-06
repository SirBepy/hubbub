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
        {/* Low-observability escape hatch until the big-screen host view gets its own pass. */}
        <button type="button" onClick={switchRole} style={switcherStyle}>
          Join instead
        </button>
      </>
    );
  }

  return <ControllerEntry key="controller" onHostInstead={switchRole} />;
}

const switcherStyle: CSSProperties = {
  position: "fixed",
  bottom: 8,
  right: 8,
  zIndex: 9999,
  font: "500 11px sans-serif",
  padding: "4px 8px",
  background: "rgba(0,0,0,.6)",
  color: "#fff",
  border: "1px solid rgba(255,255,255,.3)",
  borderRadius: 6,
  opacity: 0.6,
};
