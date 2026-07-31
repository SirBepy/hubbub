import { useState, type CSSProperties } from "react";
import { CaretLeft } from "@phosphor-icons/react";
import { PLAYER_COLORS, colorHex, colorName, Avatar, NeutralButton } from "@hubbub/ui";
import type { Player } from "@hubbub/protocol";
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
  /** Connected players in the current room, for taken-color/emoji checks. Empty pre-join. */
  roomPlayers?: Player[];
  ownPlayerId?: string;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [colorId, setColorId] = useState(initial?.colorId ?? 0);
  const [emoji, setEmoji] = useState(initial?.emoji ?? EMOJIS[0]);

  const others = (roomPlayers ?? []).filter((p) => p.connected && p.id !== ownPlayerId);
  const colorTaken = (id: number) => others.some((p) => p.colorId === id);
  const emojiTaken = (e: string) => others.some((p) => p.emoji === e);
  const hex = colorHex(colorId);

  return (
    <main style={page}>
      <div style={header}>
        {onCancel ? (
          <button type="button" onClick={onCancel} aria-label="Back" style={backButton}>
            <CaretLeft size={20} weight="bold" />
          </button>
        ) : (
          <span style={{ width: 20 }} />
        )}
        <span style={headerTitle}>Your identity</span>
        <span style={{ width: 20 }} />
      </div>

      <div style={previewOuter}>
        <div style={previewCard}>
          <div style={{ width: 104, height: 104, borderRadius: "50%", boxShadow: `0 0 28px ${hex}47` }}>
            <Avatar size={104} colorHex={hex} emoji={emoji} surface={1} />
          </div>
          <div style={previewName}>{name.trim() || "Your name"}</div>
          <div style={previewSub}>
            <span style={{ ...dot, background: hex }} />
            {colorName(colorId)} · how you appear on the TV
          </div>
        </div>
      </div>

      <div style={{ padding: "0 16px" }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          maxLength={24}
          style={nameInput}
        />
      </div>

      <div style={{ padding: "16px 16px 0" }}>
        <div style={sectionLabel}>COLOR</div>
        <div style={colorGrid}>
          {PLAYER_COLORS.map((c) => {
            const taken = colorTaken(c.id);
            return (
              <button
                key={c.id}
                type="button"
                disabled={taken}
                onClick={() => setColorId(c.id)}
                style={{ ...colorCell, opacity: taken ? 0.25 : 1, cursor: taken ? "default" : "pointer" }}
              >
                <span
                  style={{
                    ...colorSwatch,
                    background: c.hex,
                    border: colorId === c.id ? "2px solid var(--text-primary)" : "2px solid transparent",
                  }}
                />
                <span style={colorLabel}>{c.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ padding: "16px 16px 8px", flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        <div style={sectionLabel}>EMOJI</div>
        <div style={emojiGrid}>
          {EMOJIS.map((e) => {
            const taken = emojiTaken(e) && e !== emoji;
            return (
              <button
                key={e}
                type="button"
                disabled={taken}
                onClick={() => setEmoji(e)}
                style={{
                  ...emojiCell,
                  opacity: taken ? 0.25 : 1,
                  cursor: taken ? "default" : "pointer",
                  border: emoji === e ? "2px solid var(--text-primary)" : "1px solid var(--divider)",
                }}
              >
                {e}
              </button>
            );
          })}
        </div>
      </div>

      <div style={footer}>
        {onCancel ? <NeutralButton height={56} label="Cancel" onClick={onCancel} fullWidth={false} /> : null}
        <div style={{ flex: 1 }}>
          <button
            type="button"
            disabled={name.trim() === ""}
            onClick={() => onSave({ name: name.trim(), colorId, emoji })}
            style={{
              ...saveButton,
              borderColor: hex,
              background: `${hex}1a`,
              color: hex,
              opacity: name.trim() === "" ? 0.45 : 1,
            }}
          >
            Save identity
          </button>
        </div>
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
const header: CSSProperties = {
  flex: "none",
  height: 44,
  padding: "0 16px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
};
const backButton: CSSProperties = {
  width: 32,
  height: 32,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "transparent",
  border: "none",
  color: "var(--text-primary)",
  cursor: "pointer",
};
const headerTitle: CSSProperties = { font: "600 16px var(--font-ui)" };
const previewOuter: CSSProperties = { padding: "8px 16px" };
const previewCard: CSSProperties = {
  background: "var(--surface-2)",
  border: "1px solid var(--divider-heavy)",
  borderRadius: "var(--radius-lg)",
  padding: 16,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 8,
};
const previewName: CSSProperties = { font: "600 22px var(--font-ui)" };
const previewSub: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  font: "500 12px var(--font-ui)",
  color: "var(--text-muted)",
};
const dot: CSSProperties = { width: 8, height: 8, borderRadius: "50%" };
const nameInput: CSSProperties = {
  width: "100%",
  height: 44,
  padding: "0 12px",
  background: "var(--surface-1)",
  border: "1px solid var(--divider)",
  borderRadius: "var(--radius-md)",
  color: "var(--text-primary)",
  font: "500 16px var(--font-ui)",
};
const sectionLabel: CSSProperties = {
  font: "600 11px var(--font-ui)",
  letterSpacing: "0.14em",
  color: "var(--text-muted)",
  marginBottom: 8,
};
const colorGrid: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 };
const colorCell: CSSProperties = {
  height: 64,
  background: "var(--surface-1)",
  border: "1px solid var(--divider)",
  borderRadius: "var(--radius-md)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 4,
};
const colorSwatch: CSSProperties = { width: 28, height: 28, borderRadius: "50%" };
const colorLabel: CSSProperties = { font: "500 11px var(--font-ui)", color: "var(--text-secondary)" };
const emojiGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(6, 1fr)",
  gridAutoRows: 48,
  alignContent: "start",
  gap: 8,
  flex: 1,
  minHeight: 0,
  overflowY: "auto",
};
const emojiCell: CSSProperties = {
  width: 48,
  height: 48,
  background: "var(--surface-1)",
  borderRadius: "var(--radius-md)",
  fontSize: 22,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};
const footer: CSSProperties = {
  flex: "none",
  padding: 16,
  borderTop: "1px solid var(--divider)",
  display: "flex",
  gap: 8,
};
const saveButton: CSSProperties = {
  width: "100%",
  height: 56,
  border: "2px solid",
  borderRadius: "var(--radius-md)",
  font: "600 17px var(--font-ui)",
  cursor: "pointer",
  transition: "opacity 150ms ease-out",
};
