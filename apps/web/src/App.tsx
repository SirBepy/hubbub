import { useState, type CSSProperties } from "react";
import { App as ScreenApp } from "@hubbub/screen";
import { App as ControllerApp } from "@hubbub/controller";
import {
  decideInitialRole,
  getRoomCodeFromSearch,
  getStoredRoleOverride,
  setStoredRoleOverride,
  type Role,
} from "./role";

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
  return (
    <>
      {role === "screen" ? <ScreenApp key="screen" /> : <ControllerApp key="controller" />}
      <button type="button" onClick={switchRole} style={switcherStyle}>
        {role === "screen" ? "Switch to controller" : "Switch to screen"}
      </button>
    </>
  );
}

// Structural role switcher for this merge step only; the approved welcome/join mockups
// (a separate, later step) replace this with real UI.
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
