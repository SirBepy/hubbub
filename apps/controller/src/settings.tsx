import { useState, type CSSProperties } from "react";
import { GlowButton, NeutralButton, Avatar } from "@hubbub/ui";
import type { Player } from "@hubbub/protocol";
import { NEUTRAL_RING, BackHeader } from "./header";
import { EMOJIS, type Identity } from "./identity";

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
  /** Connected players in the current room, for the taken-emoji check. Empty pre-join. */
  roomPlayers?: Player[];
  ownPlayerId?: string;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [emoji, setEmoji] = useState(initial?.emoji ?? EMOJIS[0]);
  // Colour is no longer player-facing; a fresh identity still needs one on the wire
  // for games that draw pieces by colorId, so it's picked once here and never shown.
  const [colorId] = useState(initial?.colorId ?? Math.floor(Math.random() * 6));

  const others = (roomPlayers ?? []).filter((p) => p.connected && p.id !== ownPlayerId);
  const emojiTaken = (e: string) => others.some((p) => p.emoji === e);

  return (
    <main style={page}>
      {onCancel ? <BackHeader title="Change my avatar" onBack={onCancel} /> : <div style={{ height: 44 }} />}

      <div style={{ padding: "10px 14px 0" }}>
        <div style={preview}>
          <Avatar size={64} colorHex={NEUTRAL_RING} emoji={emoji} surface={1} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={fieldLabel}>Your name</div>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" maxLength={24} style={nameInput} />
          </div>
        </div>
      </div>

      <div style={{ padding: "16px 14px 0", flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        <div style={sectionLabel}>Pick a piece</div>
        <div style={emojiGrid}>
          {EMOJIS.map((e) => {
            const taken = emojiTaken(e) && e !== emoji;
            return (
              <button
                key={e}
                type="button"
                disabled={taken}
                onClick={() => setEmoji(e)}
                style={{ ...emojiCell, opacity: taken ? 0.26 : 1, cursor: taken ? "default" : "pointer", borderColor: emoji === e ? "var(--ink-amber-highlight)" : "transparent" }}
              >
                {e}
              </button>
            );
          })}
        </div>
      </div>

      <div style={footer}>
        <div style={hint}>Faded pieces are already taken by someone in the room.</div>
        <div style={footerRow}>
          {onCancel ? <NeutralButton height={48} label="Cancel" onClick={onCancel} fullWidth={false} /> : null}
          <div style={{ flex: 1 }}>
            <GlowButton label="Save" disabled={name.trim() === ""} onClick={() => onSave({ name: name.trim(), colorId, emoji })} />
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
const sectionLabel: CSSProperties = { font: "700 11px var(--font-ui)", letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8 };
const emojiGrid: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 9, flex: 1, minHeight: 0, overflowY: "auto", alignContent: "start" };
const emojiCell: CSSProperties = {
  aspectRatio: "1",
  borderRadius: "var(--radius-lg)",
  background: "rgba(242,234,217,.05)",
  border: "2px solid transparent",
  fontSize: 26,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};
const footer: CSSProperties = { flex: "none", padding: 14, borderTop: "1px solid var(--divider)", display: "flex", flexDirection: "column", gap: 10 };
const footerRow: CSSProperties = { display: "flex", gap: 8 };
const hint: CSSProperties = { textAlign: "center", font: "500 11.5px var(--font-ui)", lineHeight: 1.45, color: "var(--text-muted)" };
