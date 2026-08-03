import { describe, it, expect } from "vitest";
import { AVATAR_SETS, ALL_AVATAR_IDS, isAvatarCharacterId, randomAvatarId } from "./catalog";
import { resolveAvatarCharacter } from "./resolve";

describe("avatar catalog", () => {
  it("ships 20 characters per set, 60 total, all namespaced and unique", () => {
    expect(ALL_AVATAR_IDS.length).toBe(60);
    expect(new Set(ALL_AVATAR_IDS).size).toBe(60);
    for (const set of AVATAR_SETS) {
      expect(set.characters.length).toBe(20);
      for (const c of set.characters) expect(c.id.startsWith(`${set.id}:`)).toBe(true);
    }
  });

  it("every id fits the protocol's emoji field (max 16 chars)", () => {
    for (const id of ALL_AVATAR_IDS) expect(id.length).toBeLessThanOrEqual(16);
  });

  it("recognizes the gi:/fe:/tw: namespace and rejects plain emoji / arbitrary strings", () => {
    expect(isAvatarCharacterId("gi:wolf-head")).toBe(true);
    expect(isAvatarCharacterId("fe:zombie")).toBe(true); // namespace check only, existence is resolveAvatarCharacter's job
    expect(isAvatarCharacterId("🦊")).toBe(false);
    expect(isAvatarCharacterId("giraffe")).toBe(false);
  });

  it("resolves every shipped id to bundled artwork and falls back to null otherwise", () => {
    for (const id of ALL_AVATAR_IDS) expect(resolveAvatarCharacter(id)).not.toBeNull();
    expect(resolveAvatarCharacter("🦊")).toBeNull();
    expect(resolveAvatarCharacter("gi:nonexistent")).toBeNull();
  });

  it("randomAvatarId avoids taken ids when room has spare characters", () => {
    const taken = ALL_AVATAR_IDS.slice(0, 59);
    const picked = randomAvatarId(taken);
    expect(taken).not.toContain(picked);
  });

  it("randomAvatarId falls back to the full pool once every character is taken", () => {
    const picked = randomAvatarId(ALL_AVATAR_IDS);
    expect(ALL_AVATAR_IDS).toContain(picked);
  });
});
