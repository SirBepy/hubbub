import { AvatarArt, isAvatarCharacterId, useAvatarCharacter } from "@hubbub/sdk/avatars";

// Players carry no colour; identity is the character alone. Matches apps/controller's
// header.tsx NEUTRAL_RING so every Avatar ring in the product is the same fixed tone.
export const NEUTRAL_RING = "rgba(242,234,217,.35)";

export type AvatarProps = {
  /** Diameter. A number is px (56/44/52/104 are the sizes used across the design); a string is
   * any CSS length, so a TV surface can size one off --u instead of a fixed pixel count. */
  size: number | string;
  /** Ring color (hex). Players carry no identity color; callers should pass a
   * fixed neutral, never a per-player hue - identity lives in the character. */
  colorHex: string;
  /** A bundled character id ("gi:fox-head", "fe:zombie", "tw:octopus") or a
   * plain emoji string. Unrecognized strings render as text, same as before. */
  avatarId: string;
  /** Fill surface. Screen rail uses --surface-2, phone chrome uses --surface-1. */
  surface?: 1 | 2;
  /** Drops the avatar to 45% opacity; identity is reserved, not cleared. */
  disconnected?: boolean;
  /** 8px/600 "HOST" badge, #161826 on the product accent, top-right. */
  host?: boolean;
};

export function Avatar({ size, colorHex, avatarId, surface = 1, disconnected, host }: AvatarProps) {
  const character = useAvatarCharacter(avatarId);
  const bundled = isAvatarCharacterId(avatarId);
  return (
    <div
      style={{
        position: "relative",
        width: size,
        height: size,
        flex: "none",
        opacity: disconnected ? 0.45 : 1,
      }}
    >
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: surface === 2 ? "var(--surface-2)" : "var(--surface-1)",
          border: `2px solid ${colorHex}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: typeof size === "number" ? size / 2 : `calc(${size} / 2)`,
          lineHeight: 1,
          overflow: "hidden",
          color: "var(--text-primary)",
        }}
      >
        {character ? <AvatarArt character={character} /> : bundled ? null : avatarId}
      </div>
      {host ? (
        <span
          style={{
            position: "absolute",
            top: -2,
            right: 2,
            font: "600 8px var(--font-ui)",
            letterSpacing: "0.06em",
            color: "#2A1A08",
            background: "var(--accent)",
            borderRadius: 3,
            padding: "1px 3px",
          }}
        >
          HOST
        </span>
      ) : null}
    </div>
  );
}
