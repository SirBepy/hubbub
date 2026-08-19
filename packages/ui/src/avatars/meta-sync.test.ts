import { describe, it, expect } from "vitest";
import { GAME_ICONS_META } from "./game-icons-meta";
import { FLUENT_EMOJI_META } from "./fluent-emoji-meta";
import { TWEMOJI_META } from "./twemoji-meta";
import { GAME_ICONS } from "./game-icons";
import { FLUENT_EMOJI } from "./fluent-emoji";
import { TWEMOJI } from "./twemoji";

// Imports the heavy art files, which is fine here since a test never ships to a browser -
// see resolve.ts's dynamic import() for why production code never does this.
function assertIdSetsMatch(setName: string, metaIds: string[], artIds: string[]) {
  const metaOnly = metaIds.filter((id) => !artIds.includes(id));
  const artOnly = artIds.filter((id) => !metaIds.includes(id));
  const message =
    `${setName}: meta/art id mismatch.` +
    (metaOnly.length ? ` In meta but not art: ${metaOnly.join(", ")}.` : "") +
    (artOnly.length ? ` In art but not meta: ${artOnly.join(", ")}.` : "");
  expect(metaOnly.length === 0 && artOnly.length === 0, message).toBe(true);
}

describe("avatar meta/art sync", () => {
  it("game-icons meta and art declare exactly the same ids", () => {
    assertIdSetsMatch(
      "gi",
      GAME_ICONS_META.map((m) => m.id),
      GAME_ICONS.map((a) => a.id),
    );
  });

  it("fluent-emoji meta and art declare exactly the same ids", () => {
    assertIdSetsMatch(
      "fe",
      FLUENT_EMOJI_META.map((m) => m.id),
      FLUENT_EMOJI.map((a) => a.id),
    );
  });

  it("twemoji meta and art declare exactly the same ids", () => {
    assertIdSetsMatch(
      "tw",
      TWEMOJI_META.map((m) => m.id),
      TWEMOJI.map((a) => a.id),
    );
  });
});
