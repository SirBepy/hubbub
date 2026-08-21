import type { DisplayPlayer as Player } from "@hubbub/sdk";
import { Avatar, NEUTRAL_RING } from "./Avatar";

export type MiniIdentityProps = {
  player: Player | null;
  mark: string;
  roleColor: string;
  emphasized: boolean;
};

/** Controller-side bookend: small avatar and role mark, used either side of "VS". */
export function MiniIdentity({ player, mark, roleColor, emphasized }: MiniIdentityProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 10px",
        borderRadius: "var(--radius-md)",
        border: emphasized ? `1px solid ${roleColor}` : "1px solid var(--divider)",
        opacity: player && !player.connected ? 0.45 : 1,
        transition: "border-color 150ms ease-out",
      }}
    >
      {player ? (
        <Avatar size={32} colorHex={NEUTRAL_RING} avatarId={player.avatarId} />
      ) : (
        <div style={{ width: 32, height: 32 }} />
      )}
      <span style={{ font: "700 16px var(--font-display)", color: roleColor }}>{mark}</span>
    </div>
  );
}
