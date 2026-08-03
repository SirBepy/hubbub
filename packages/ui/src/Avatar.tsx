export type AvatarProps = {
  /** Diameter in px — 56/44/52/104 are the sizes used across the design. */
  size: number;
  /** Player identity color (hex) — the ring. Get this from palette.ts. */
  colorHex: string;
  emoji: string;
  /** Fill surface. Screen rail uses --surface-2, phone chrome uses --surface-1. */
  surface?: 1 | 2;
  /** Drops the avatar to 45% opacity; identity is reserved, not cleared. */
  disconnected?: boolean;
  /** 8px/600 "HOST" badge, #161826 on the product accent, top-right. */
  host?: boolean;
};

export function Avatar({ size, colorHex, emoji, surface = 1, disconnected, host }: AvatarProps) {
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
          fontSize: size / 2,
          lineHeight: 1,
        }}
      >
        {emoji}
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
