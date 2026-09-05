import type { CSSProperties } from "react";

const WRAP: CSSProperties = {
  flex: 1,
  minHeight: 0,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  textAlign: "center",
  padding: "0 8px",
};
const TITLE: CSSProperties = { font: "700 20px/1.2 var(--font-ui)", color: "var(--text-primary)" };
const BODY: CSSProperties = { font: "500 14px/1.4 var(--font-ui)", color: "var(--text-secondary)" };

/** Phone half of the failure beat. Plain px, not the TV's `--u` scale, which this app never
 * defines. A non-host never gets host-shaped copy: "Back to lobby" exists on the host's phone
 * and nowhere else, so telling the room to press it points most of them at nothing. */
export function GameFailed({ isHost }: { isHost: boolean }) {
  return (
    <div style={WRAP} role="alert">
      <div style={TITLE}>{isHost ? "This game hit a problem" : "Hang tight"}</div>
      <div style={BODY}>{isHost ? "Back to the lobby…" : "Watch the TV"}</div>
    </div>
  );
}
