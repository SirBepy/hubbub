import { useState, type CSSProperties } from "react";
import { GlowButton } from "@hubbub/ui";
import { ROOM_CODE_LENGTH } from "@hubbub/protocol";
import { IdentityHeader } from "../../controller/src/header";
import type { Identity } from "../../controller/src/identity";

/** Returning-visit phone screen: real IdentityHeader, then code entry centered
 * between header and footer, then a muted "Host instead" escape at the bottom. */
export function JoinScreen({
  identity,
  onEditIdentity,
  onJoin,
  onHostInstead,
}: {
  identity: Identity;
  onEditIdentity: () => void;
  onJoin: (code: string) => void;
  onHostInstead: () => void;
}) {
  const [code, setCode] = useState("");

  return (
    <main style={page}>
      <IdentityHeader name={identity.name} avatarId={identity.avatarId} isHost={false} onOpenMenu={onEditIdentity} />

      <div style={main}>
        <p style={label}>On this phone</p>
        <h1 style={heading}>Ready to play?</h1>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="CODE"
          maxLength={ROOM_CODE_LENGTH}
          style={codeInput}
        />
        <GlowButton height={60} label="Join room" disabled={code.length !== ROOM_CODE_LENGTH} onClick={() => onJoin(code)} />
      </div>

      <div style={footer}>
        <button type="button" onClick={onHostInstead} style={hostLink}>
          Host instead
        </button>
      </div>
    </main>
  );
}

const page: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  height: "100dvh",
  background: "var(--surface-0)",
  color: "var(--text-primary)",
};
const main: CSSProperties = {
  flex: 1,
  minHeight: 0,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: "0 28px",
  gap: 16,
};
const label: CSSProperties = { margin: 0, font: "700 11px var(--font-ui)", letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--text-muted)" };
const heading: CSSProperties = { margin: 0, font: "700 26px var(--font-display)", textAlign: "center" };
const codeInput: CSSProperties = {
  marginTop: 8,
  height: 64,
  width: "100%",
  textAlign: "center",
  background: "var(--surface-1)",
  border: "1px solid var(--divider)",
  borderRadius: "var(--radius-md)",
  color: "var(--text-primary)",
  font: "700 30px var(--font-display)",
  letterSpacing: "0.22em",
};
const footer: CSSProperties = { flex: "none", display: "flex", justifyContent: "center", padding: "14px 0 30px" };
const hostLink: CSSProperties = {
  background: "none",
  border: "none",
  padding: "8px 10px",
  font: "500 13px var(--font-ui)",
  color: "var(--text-muted)",
  cursor: "pointer",
};
