import { describe, it, expect } from "vitest";
import { AVATAR_SETS, ALL_AVATAR_IDS, isAvatarCharacterId, randomAvatarId } from "./catalog";
import { resolveAvatarCharacter } from "./resolve";
import { GAME_ICONS_META } from "./game-icons-meta";
import { FLUENT_EMOJI_META } from "./fluent-emoji-meta";
import { TWEMOJI_META } from "./twemoji-meta";

// Expected counts derive from the meta files (same source AVATAR_SETS itself builds from),
// not hardcoded numbers, so this test never needs a manual bump on top of the meta edit.
const EXPECTED_COUNTS: Record<string, number> = {
  gi: GAME_ICONS_META.length,
  fe: FLUENT_EMOJI_META.length,
  tw: TWEMOJI_META.length,
};

describe("avatar catalog", () => {
  it("ships one character per meta entry, all namespaced and unique", () => {
    const total = GAME_ICONS_META.length + FLUENT_EMOJI_META.length + TWEMOJI_META.length;
    expect(ALL_AVATAR_IDS.length).toBe(total);
    expect(new Set(ALL_AVATAR_IDS).size).toBe(total);
    for (const set of AVATAR_SETS) {
      expect(set.characters.length).toBe(EXPECTED_COUNTS[set.id]);
      for (const c of set.characters) expect(c.id.startsWith(`${set.id}:`)).toBe(true);
    }
  });

  it("every id fits the protocol's emoji field (max 16 chars)", () => {
    for (const id of ALL_AVATAR_IDS) expect(id.length).toBeLessThanOrEqual(16);
  });

  it("recognizes the gi:/fe:/tw: namespace and rejects plain emoji / arbitrary strings", () => {
    expect(isAvatarCharacterId("gi:fox-head")).toBe(true);
    expect(isAvatarCharacterId("fe:zombie")).toBe(true); // namespace check only, existence is resolveAvatarCharacter's job
    expect(isAvatarCharacterId("🦊")).toBe(false);
    expect(isAvatarCharacterId("giraffe")).toBe(false);
  });

  it("resolves every shipped id to bundled artwork and falls back to null otherwise", async () => {
    for (const id of ALL_AVATAR_IDS) expect(await resolveAvatarCharacter(id)).not.toBeNull();
    expect(await resolveAvatarCharacter("🦊")).toBeNull();
    expect(await resolveAvatarCharacter("gi:nonexistent")).toBeNull();
  });

  it("randomAvatarId avoids taken ids when room has spare characters", () => {
    const taken = ALL_AVATAR_IDS.slice(0, ALL_AVATAR_IDS.length - 1);
    const picked = randomAvatarId(taken);
    expect(taken).not.toContain(picked);
  });

  it("randomAvatarId falls back to the full pool once every character is taken", () => {
    const picked = randomAvatarId(ALL_AVATAR_IDS);
    expect(ALL_AVATAR_IDS).toContain(picked);
  });
});
