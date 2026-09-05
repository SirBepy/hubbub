import type { CSSProperties, ReactNode } from "react";
import { ShareNetwork, HandArrowDown, UserCircle, Question, Info, SignOut, X } from "@phosphor-icons/react";
import { Avatar } from "@hubbub/ui";
import type { Player } from "@hubbub/protocol";
import { NEUTRAL_RING } from "./header";

// Mockup's danger red - not yet a design-system token, so it lives here literally.
const DANGER = "#E8657F";

export function MenuScreen({
  me,
  isHost,
  onClose,
  onShare,
  onPassRemote,
  onChangeAvatar,
  onHowToPlay,
  onAbout,
  onLeave,
}: {
  me: Player;
  isHost: boolean;
  onClose: () => void;
  onShare: () => void;
  onPassRemote: () => void;
  onChangeAvatar: () => void;
  onHowToPlay: () => void;
  onAbout: () => void;
  onLeave: () => void;
}) {
  return (
    <main className="hb-anim-deal" style={page}>
      <div style={header}>
        <Avatar size={52} colorHex={NEUTRAL_RING} avatarId={me.avatarId} surface={1} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={name}>{me.name}</div>
          <div style={sub}>{isHost ? "Host of this room" : "In this room"}</div>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" style={closeButton}>
          <X size={18} weight="bold" />
        </button>
      </div>

      <MenuItem icon={<ShareNetwork size={22} weight="bold" />} label="Share the room" hint="QR, link, or send it" onClick={onShare} />
      {isHost ? <MenuItem icon={<HandArrowDown size={22} weight="bold" />} label="Pass the remote" hint="Host only" onClick={onPassRemote} /> : null}
      <MenuItem icon={<UserCircle size={22} weight="bold" />} label="Change my avatar" onClick={onChangeAvatar} />
      <MenuItem icon={<Question size={22} weight="bold" />} label="How to play" onClick={onHowToPlay} />
      <MenuItem icon={<Info size={22} weight="bold" />} label="About" onClick={onAbout} />
      <MenuItem icon={<SignOut size={22} weight="bold" />} label="Leave the room" onClick={onLeave} danger />
    </main>
  );
}

function MenuItem({ icon, label, hint, onClick, danger }: { icon: ReactNode; label: string; hint?: string; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} style={{ ...item, ...(danger ? itemDanger : null) }}>
      <span style={{ color: danger ? DANGER : "var(--accent)", display: "flex" }}>{icon}</span>
      <span>
        <span style={itemLabel}>{label}</span>
        {hint ? <span style={itemHint}>{hint}</span> : null}
      </span>
    </button>
  );
}

const page: CSSProperties = { display: "flex", flexDirection: "column", height: "100dvh", background: "#141009", color: "var(--text-primary)", padding: "14px 0 20px" };
const header: CSSProperties = { display: "flex", alignItems: "center", gap: 10, padding: "2px 20px 18px", borderBottom: "1px solid var(--divider)" };
const name: CSSProperties = { font: "700 22px var(--font-display)", lineHeight: 1.1 };
const sub: CSSProperties = { marginTop: 2, font: "600 11px var(--font-ui)", color: "var(--text-muted)" };
const closeButton: CSSProperties = {
  flex: "none",
  width: 34,
  height: 34,
  borderRadius: 9,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(242,234,217,.06)",
  border: "1px solid var(--divider-heavy)",
  color: "rgba(242,234,217,.72)",
  cursor: "pointer",
};
const item: CSSProperties = { display: "flex", alignItems: "center", gap: 13, padding: "19px 20px", font: "600 18px var(--font-ui)", color: "rgba(242,234,217,.86)", background: "transparent", border: "none", textAlign: "left", cursor: "pointer" };
const itemDanger: CSSProperties = { color: DANGER, marginTop: "auto", borderTop: "1px solid var(--divider)" };
const itemLabel: CSSProperties = { display: "block" };
const itemHint: CSSProperties = { display: "block", marginTop: 2, font: "500 11px var(--font-ui)", color: "var(--text-faint)" };
