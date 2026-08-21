import { useState, type CSSProperties } from "react";
import { GlowButton, NeutralButton, Avatar, AVATAR_SETS, randomAvatarId } from "@hubbub/ui";
import type { Player } from "@hubbub/protocol";
import { NEUTRAL_RING, BackHeader } from "./header";
import type { Identity } from "./identity";

export function Settings({
  initial,
  onSave,
  onCancel,
  roomPlayers,
  ownPlayerId,
}: {
  initial?: Identity;
  onSave: (id: Identity) => void;
  onCancel?: () => void;
  /** Connected players in the current room, for the taken-character check. Empty pre-join. */
  roomPlayers?: Player[];
  ownPlayerId?: string;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const others = (roomPlayers ?? []).filter((p) => p.connected && p.id !== ownPlayerId);
  const [avatarId, setAvatarId] = useState(initial?.avatarId ?? (() => randomAvatarId(others.map((p) => p.avatarId))));
  // Colour is no longer player-facing; a fresh identity still needs one on the wire
  // for games that draw pieces by colorId, so it's picked once here and never shown.
  const [colorId] = useState(initial?.colorId ?? Math.floor(Math.random() * 6));

  const avatarIdTaken = (e: string) => others.some((p) => p.avatarId === e);

  return (
    <main style={page}>
      {onCancel ? <BackHeader title="Change my avatar" onBack={onCancel} /> : <div style={{ height: 44 }} />}

      <div style={{ padding: "10px 14px 0" }}>
        <div style={preview}>
          <Avatar size={64} colorHex={NEUTRAL_RING} avatarId={avatarId} surface={1} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={fieldLabel}>Your name</div>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" maxLength={24} style={nameInput} />
          </div>
        </div>
      </div>

      <div style={{ padding: "16px 14px 0", flex: 1, minHeight: 0, overflowY: "auto" }}>
        {AVATAR_SETS.map((set) => (
          <div key={set.id} style={setGroup}>
            <div style={setHeaderRow}>
              <span style={sectionLabel}>{set.name}</span>
              <span style={licenceTag}>{set.licenseName}</span>
            </div>
            <div style={attribLine}>{set.attribution}</div>
            <div style={avatarIdGrid}>
              {set.characters.map((c) => {
                const taken = avatarIdTaken(c.id) && c.id !== avatarId;
                return (
                  <button
                    key={c.id}
                    type="button"
                    disabled={taken}
                    onClick={() => setAvatarId(c.id)}
                    title={c.label}
                    style={{ ...avatarIdCell, opacity: taken ? 0.26 : 1, cursor: taken ? "default" : "pointer", borderColor: avatarId === c.id ? "var(--ink-amber-highlight)" : "transparent" }}
                  >
                    <Avatar size={40} colorHex={NEUTRAL_RING} avatarId={c.id} surface={1} />
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div style={footer}>
        <div style={hint}>Faded characters are already taken by someone in the room.</div>
        <div style={footerRow}>
          {onCancel ? <NeutralButton height={48} label="Cancel" onClick={onCancel} fullWidth={false} /> : null}
          <div style={{ flex: 1 }}>
            <GlowButton label="Save" disabled={name.trim() === ""} onClick={() => onSave({ name: name.trim(), colorId, avatarId })} />
          </div>
        </div>
      </div>
    </main>
  );
}

const page: CSSProperties = { display: "flex", flexDirection: "column", height: "100dvh", background: "var(--surface-0)", color: "var(--text-primary)" };
const preview: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 14,
  padding: 14,
  borderRadius: "var(--radius-lg)",
  background: "rgba(242,234,217,.05)",
  border: "1px solid var(--divider-heavy)",
};
const fieldLabel: CSSProperties = { font: "700 10.5px var(--font-ui)", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 5 };
const nameInput: CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: "var(--radius-md)",
  background: "rgba(242,234,217,.07)",
  border: "1px solid var(--divider-heavy)",
  color: "var(--text-primary)",
  font: "600 16px var(--font-ui)",
};
const sectionLabel: CSSProperties = { font: "700 11px var(--font-ui)", letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--text-muted)" };
const setGroup: CSSProperties = { marginBottom: 22 };
const setHeaderRow: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 4 };
const licenceTag: CSSProperties = {
  flex: "none",
  font: "700 9px var(--font-ui)",
  letterSpacing: "0.08em",
  color: "var(--text-faint)",
  border: "1px solid var(--divider-heavy)",
  borderRadius: 4,
  padding: "2px 6px",
};
const attribLine: CSSProperties = { font: "500 10.5px var(--font-ui)", lineHeight: 1.4, color: "var(--text-faint)", marginBottom: 10 };
const avatarIdGrid: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 9 };
const avatarIdCell: CSSProperties = {
  aspectRatio: "1",
  borderRadius: "var(--radius-lg)",
  background: "rgba(242,234,217,.05)",
  border: "2px solid transparent",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};
const footer: CSSProperties = { flex: "none", padding: 14, borderTop: "1px solid var(--divider)", display: "flex", flexDirection: "column", gap: 10 };
const footerRow: CSSProperties = { display: "flex", gap: 8 };
const hint: CSSProperties = { textAlign: "center", font: "500 11.5px var(--font-ui)", lineHeight: 1.45, color: "var(--text-muted)" };
