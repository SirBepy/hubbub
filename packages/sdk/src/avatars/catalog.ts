// Metadata only (id/label) - the heavy per-icon art lives in game-icons.ts / fluent-emoji.ts /
// twemoji.ts and is loaded on demand by resolve.ts, so it never rides the eager bundle.
import { GAME_ICONS_META } from "./game-icons-meta";
import { FLUENT_EMOJI_META } from "./fluent-emoji-meta";
import { TWEMOJI_META } from "./twemoji-meta";

export type AvatarSetId = "gi" | "fe" | "tw";

export type AvatarCharacter = { id: string; label: string; setId: AvatarSetId };

// Adding a set: give it an id here AND matching entries in both its -meta.ts (eager) and
// its art file (lazy, resolve.ts). meta-sync.test.ts fails by name if the two ever disagree.

export type AvatarSet = {
  id: AvatarSetId;
  /** Group label shown in the picker. */
  name: string;
  licenseName: string;
  /** Exact required credit line, shown next to the group and on the About screen. */
  attribution: string;
  licenseFile: string;
  characters: AvatarCharacter[];
};

export const AVATAR_SETS: AvatarSet[] = [
  {
    id: "gi",
    name: "game-icons.net",
    licenseName: "CC BY 3.0",
    attribution: "Icons made by delapouite and lorc (game-icons.net), licensed under CC BY 3.0.",
    licenseFile: "packages/sdk/licenses/LICENSE-game-icons.txt",
    characters: GAME_ICONS_META.map((g) => ({ id: g.id, label: g.label, setId: "gi" as const })),
  },
  {
    id: "fe",
    name: "Fluent Emoji",
    licenseName: "MIT",
    attribution: "Fluent Emoji by Microsoft, MIT License.",
    licenseFile: "packages/sdk/licenses/LICENSE-fluent-emoji.txt",
    characters: FLUENT_EMOJI_META.map((f) => ({ id: f.id, label: f.label, setId: "fe" as const })),
  },
  {
    id: "tw",
    name: "Twemoji",
    licenseName: "CC BY 4.0",
    attribution: "Graphics titled Twemoji, copyright Twitter Inc and other contributors, licensed under CC BY 4.0.",
    licenseFile: "packages/sdk/licenses/LICENSE-twemoji.txt",
    characters: TWEMOJI_META.map((t) => ({ id: t.id, label: t.label, setId: "tw" as const })),
  },
];

export const ALL_AVATAR_IDS: string[] = AVATAR_SETS.flatMap((s) => s.characters.map((c) => c.id));

const ID_PREFIXES = ["gi:", "fe:", "tw:"];

/** True for any bundled character id, namespaced so it never collides with a real emoji character. */
export function isAvatarCharacterId(value: string): boolean {
  return ID_PREFIXES.some((p) => value.startsWith(p));
}

/** Picks a random bundled character, preferring one not already taken in the room. */
export function randomAvatarId(taken: Iterable<string> = []): string {
  const takenSet = taken instanceof Set ? taken : new Set(taken);
  const available = ALL_AVATAR_IDS.filter((id) => !takenSet.has(id));
  const pool = available.length > 0 ? available : ALL_AVATAR_IDS;
  return pool[Math.floor(Math.random() * pool.length)];
}
