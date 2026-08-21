import type { CSSProperties } from "react";
import { HandArrowDown } from "@phosphor-icons/react";
import { Avatar } from "@hubbub/ui";
import type { Player } from "@hubbub/protocol";
import { BackHeader, NEUTRAL_RING } from "./header";

export function PassRemoteScreen({
  players,
  playerId,
  onTransfer,
  onBack,
}: {
  players: Player[];
  playerId: string;
  onTransfer: (toPlayerId: string) => void;
  onBack: () => void;
}) {
  const others = players.filter((p) => p.id !== playerId && p.connected);

  return (
    <main style={page}>
      <BackHeader title="Pass the remote" onBack={onBack} />
      <div style={body}>
        {others.length === 0 ? (
          <p style={hint}>No one else is in the room yet.</p>
        ) : (
          others.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                onTransfer(p.id);
                onBack();
              }}
              style={row}
            >
              <Avatar size={40} colorHex={NEUTRAL_RING} avatarId={p.avatarId} surface={1} />
              <span style={rowName}>{p.name}</span>
              <HandArrowDown size={20} weight="bold" style={{ color: "var(--accent)" }} />
            </button>
          ))
        )}
      </div>
    </main>
  );
}

const page: CSSProperties = { display: "flex", flexDirection: "column", height: "100dvh", background: "var(--surface-0)", color: "var(--text-primary)" };
const body: CSSProperties = { flex: 1, minHeight: 0, overflowY: "auto", padding: "10px 14px", display: "flex", flexDirection: "column", gap: 9 };
const hint: CSSProperties = { marginTop: 24, textAlign: "center", font: "500 13px var(--font-ui)", color: "var(--text-faint)" };
const row: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "12px 14px",
  borderRadius: "var(--radius-lg)",
  background: "rgba(242,234,217,.045)",
  border: "1px solid var(--divider)",
  color: "var(--text-primary)",
  textAlign: "left",
  cursor: "pointer",
};
const rowName: CSSProperties = { flex: 1, minWidth: 0, font: "600 16px var(--font-ui)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
