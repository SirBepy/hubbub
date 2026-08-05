import type { DisplayPlayer as Player } from "@hubbub/sdk";
import { Avatar } from "./Avatar";
import { colorHex, hexToRgba } from "./palette";

export type IdentityCardProps = {
  mark: string;
  roleColor: string;
  player: Player | null;
  glowing: boolean;
};

/** Screen-side bookend: avatar, name, and role mark either side of a board. */
export function IdentityCard({ mark, roleColor, player, glowing }: IdentityCardProps) {
  return (
    <div
      style={{
        width: 280,
        flex: "none",
        borderRadius: "var(--radius-md)",
        border: glowing ? `2px solid ${roleColor}` : "1px solid var(--divider)",
        background: glowing ? hexToRgba(roleColor, 0.13) : "var(--surface-1)",
        boxShadow: glowing ? `0 0 28px ${hexToRgba(roleColor, 0.3)}` : "none",
        padding: 24,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
        opacity: player && !player.connected ? 0.45 : 1,
        transition: "border-color 150ms ease-out, box-shadow 150ms ease-out, background 150ms ease-out",
      }}
    >
      {player ? (
        <Avatar size={56} colorHex={colorHex(player.colorId)} emoji={player.emoji} surface={2} />
      ) : (
        <div style={{ width: 56, height: 56 }} />
      )}
      <div style={{ font: "500 22px var(--font-ui)", color: "var(--text-primary)" }}>
        {player?.name ?? "Waiting…"}
      </div>
      <div style={{ font: "700 72px/1 var(--font-display)", color: roleColor }}>{mark}</div>
      <div style={{ font: "500 13px var(--font-ui)", letterSpacing: "0.12em", color: "var(--text-muted)" }}>
        {mark}
      </div>
    </div>
  );
}
