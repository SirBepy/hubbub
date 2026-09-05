import { type CSSProperties } from "react";
import { ROOM_CODE_LENGTH } from "@hubbub/protocol";
import { Avatar, GlowButton } from "@hubbub/ui";
import { NEUTRAL_RING } from "./header";
import { Settings } from "./settings";
import type { Identity } from "./identity";

export function JoinScreen({
  identity,
  code,
  onCodeChange,
  status,
  error,
  onJoin,
  settingsOpen,
  onOpenSettings,
  onSaveIdentity,
  onCancelSettings,
}: {
  identity: Identity;
  code: string;
  onCodeChange: (code: string) => void;
  status: "idle" | "joining" | "in" | "error";
  error: string;
  onJoin: () => void;
  settingsOpen: boolean;
  onOpenSettings: () => void;
  onSaveIdentity: (id: Identity) => void;
  onCancelSettings: () => void;
}) {
  return (
    <main className="hb-anim-deal" style={page}>
      <div style={wordmark}>HUBBUB</div>
      <div style={identityRow}>
        <Avatar size={52} colorHex={NEUTRAL_RING} avatarId={identity.avatarId} surface={1} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={identityName}>{identity.name}</div>
        </div>
        <button type="button" onClick={onOpenSettings} style={editButton}>
          Edit
        </button>
      </div>
      {settingsOpen ? (
        <Settings initial={identity} onSave={onSaveIdentity} onCancel={onCancelSettings} />
      ) : (
        <>
          <input
            value={code}
            onChange={(e) => onCodeChange(e.target.value.toUpperCase())}
            placeholder="CODE"
            maxLength={ROOM_CODE_LENGTH}
            style={codeInput}
          />
          <GlowButton
            height={56}
            label={status === "joining" ? "Joining…" : "Join room"}
            disabled={code.length !== ROOM_CODE_LENGTH || status === "joining"}
            onClick={onJoin}
          />
          {status === "error" && <p style={errorText}>{error}</p>}
        </>
      )}
    </main>
  );
}

const page: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 16,
  height: "100dvh",
  padding: 16,
  background: "var(--surface-0)",
  color: "var(--text-primary)",
};
const wordmark: CSSProperties = { font: "700 22px var(--font-display)", letterSpacing: "0.03em" };
const identityRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: 12,
  background: "var(--surface-1)",
  border: "1px solid var(--divider)",
  borderRadius: "var(--radius-md)",
};
const identityName: CSSProperties = { font: "600 18px var(--font-ui)" };
const editButton: CSSProperties = {
  flex: "none",
  font: "600 13px var(--font-ui)",
  color: "var(--accent)",
  background: "transparent",
  border: "1px solid rgba(145,132,217,.55)",
  borderRadius: "var(--radius-md)",
  padding: "8px 12px",
  cursor: "pointer",
};
const codeInput: CSSProperties = {
  height: 56,
  padding: "0 12px",
  textAlign: "center",
  background: "var(--surface-1)",
  border: "1px solid var(--divider)",
  borderRadius: "var(--radius-md)",
  color: "var(--text-primary)",
  font: "700 32px var(--font-display)",
  letterSpacing: "0.12em",
};
const errorText: CSSProperties = { color: "var(--player-magenta)", font: "500 13px var(--font-ui)" };
