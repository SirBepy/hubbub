import { resolveAvatarCharacter, type ResolvedAvatarCharacter } from "./avatars/resolve";

export type AvatarProps = {
  /** Diameter in px - 56/44/52/104 are the sizes used across the design. */
  size: number;
  /** Ring color (hex). Players carry no identity color; callers should pass a
   * fixed neutral, never a per-player hue - identity lives in the character. */
  colorHex: string;
  /** A bundled character id ("gi:fox-head", "fe:zombie", "tw:octopus") or a
   * plain emoji string. Unrecognized strings render as text, same as before. */
  emoji: string;
  /** Fill surface. Screen rail uses --surface-2, phone chrome uses --surface-1. */
  surface?: 1 | 2;
  /** Drops the avatar to 45% opacity; identity is reserved, not cleared. */
  disconnected?: boolean;
  /** 8px/600 "HOST" badge, #161826 on the product accent, top-right. */
  host?: boolean;
};

export function Avatar({ size, colorHex, emoji, surface = 1, disconnected, host }: AvatarProps) {
  const character = resolveAvatarCharacter(emoji);
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
          overflow: "hidden",
        }}
      >
        {character ? <AvatarGlyph character={character} size={size} /> : emoji}
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

/** game-icons render single-tone at 60% of the frame in ink, never colorHex - color
 * must never carry identity. Fluent/Twemoji are already multi-tone circular art, so
 * they sit at 80% to nearly fill the ring the way native emoji glyphs already did. */
function AvatarGlyph({ character, size }: { character: ResolvedAvatarCharacter; size: number }) {
  if (character.kind === "gi") {
    const glyphSize = size * 0.6;
    return (
      <svg viewBox="0 0 512 512" width={glyphSize} height={glyphSize} style={{ color: "var(--text-primary)" }}>
        <path fill="currentColor" d={character.d} />
      </svg>
    );
  }
  const glyphSize = size * 0.8;
  // Bundled build-time markup, never user input - dangerouslySetInnerHTML is safe here.
  return (
    <svg
      viewBox={character.viewBox}
      width={glyphSize}
      height={glyphSize}
      dangerouslySetInnerHTML={{ __html: character.markup }}
    />
  );
}
