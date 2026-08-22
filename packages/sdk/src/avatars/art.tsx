import { useEffect, useState } from "react";
import { resolveAvatarCharacter, resolveAvatarCharacterSync, type ResolvedAvatarCharacter } from "./resolve.js";

/** Art loads lazily per set (see resolve.ts); the sync cache is warm almost immediately since it
 * starts loading at app boot, so this only returns null on a genuinely cold start. Exported so a
 * game with its own frame can draw the art without inheriting @hubbub/ui's Avatar ring. */
export function useAvatarCharacter(avatarId: string): ResolvedAvatarCharacter | null {
  const [character, setCharacter] = useState<ResolvedAvatarCharacter | null>(() => resolveAvatarCharacterSync(avatarId));
  useEffect(() => {
    const cached = resolveAvatarCharacterSync(avatarId);
    if (cached) {
      setCharacter(cached);
      return;
    }
    let alive = true;
    resolveAvatarCharacter(avatarId).then((c) => alive && setCharacter(c));
    return () => {
      alive = false;
    };
  }, [avatarId]);
  return character;
}

/** game-icons render single-tone at 60% of the frame in the inherited `color`, never colorHex -
 * color must never carry identity. Fluent/Twemoji are already multi-tone circular art, so they
 * sit at 80% to nearly fill the ring the way native emoji glyphs already did. */
export function AvatarArt({ character }: { character: ResolvedAvatarCharacter }) {
  if (character.kind === "gi") {
    return (
      <svg viewBox="0 0 512 512" style={{ width: "60%", height: "60%" }}>
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
