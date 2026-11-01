import { describe, expect, it } from "vitest";
import { GAME_LOGICS, SANDBOX_GAME_IDS } from "@hubbub/games-manifest";
import { catalog } from "../src/catalog.js";

describe("production catalogue", () => {
  const ids = catalog.summaries.map((s) => s.id);

  it("leaves out core games that have no sandbox bundle to load", () => {
    expect(ids).not.toContain("ttt");
    expect(ids).not.toContain("uttt");
  });

  it("lists exactly the sandbox-capable games the manifest has on disk", () => {
    expect(ids.sort()).toEqual(Object.keys(GAME_LOGICS).filter((id) => SANDBOX_GAME_IDS.includes(id)).sort());
  });

  // A checkout without the sibling repos legitimately has no bundled game to assert on.
  it.skipIf(!("tap-race" in GAME_LOGICS))("keeps a bundled sibling game", () => {
    expect(ids).toContain("tap-race");
  });
});
