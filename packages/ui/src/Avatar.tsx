import { useEffect, useState } from "react";
import { resolveAvatarCharacter, resolveAvatarCharacterSync, type ResolvedAvatarCharacter } from "./avatars/resolve";
import { isAvatarCharacterId } from "./avatars/catalog";

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
  emoji: string;
  /** Fill surface. Screen rail uses --surface-2, phone chrome uses --surface-1. */
  surface?: 1 | 2;
  /** Drops the avatar to 45% opacity; identity is reserved, not cleared. */
  disconnected?: boolean;
  /** 8px/600 "HOST" badge, #161826 on the product accent, top-right. */
  host?: boolean;
};

export function Avatar({ size, colorHex, emoji, surface = 1, disconnected, host }: AvatarProps) {
  // Art loads lazily per set (see resolve.ts); the sync cache is warm almost immediately since
  // it starts loading at app boot, so this only shows a blank ring on a genuinely cold start.
  const [character, setCharacter] = useState<ResolvedAvatarCharacter | null>(() => resolveAvatarCharacterSync(emoji));
  useEffect(() => {
    const cached = resolveAvatarCharacterSync(emoji);
    if (cached) {
      setCharacter(cached);
      return;
    }
    let alive = true;
    resolveAvatarCharacter(emoji).then((c) => alive && setCharacter(c));
    return () => {
      alive = false;
    };
  }, [emoji]);
  const bundled = isAvatarCharacterId(emoji);
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
        }}
      >
        {character ? <AvatarGlyph character={character} /> : bundled ? null : emoji}
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
function AvatarGlyph({ character }: { character: ResolvedAvatarCharacter }) {
  if (character.kind === "gi") {
    return (
      <svg viewBox="0 0 512 512" style={{ width: "60%", height: "60%", color: "var(--text-primary)" }}>
        <path fill="currentColor" d={character.d} />
      </svg>
    );
  }
  // Bundled build-time markup, never user input - dangerouslySetInnerHTML is safe here.
  return (
    <svg
      viewBox={character.viewBox}
      style={{ width: "80%", height: "80%" }}
      dangerouslySetInnerHTML={{ __html: character.markup }}
    />
  );
}
