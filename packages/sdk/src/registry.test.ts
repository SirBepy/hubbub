import { describe, it, expect } from "vitest";
import { z } from "zod";
import { gameSummaries, type GameRegistry } from "./registry.js";
import type { GameLogic } from "./types.js";

const fake = (name: string, minPlayers: number, maxPlayers?: number): GameLogic<any, any> => ({
  meta: { name, minPlayers, maxPlayers },
  actionSchema: z.any(),
  init: () => ({}),
  onAction: (s) => s,
  onPlayersChanged: (s) => s,
});

describe("gameSummaries", () => {
  it("derives summaries from a registry, featured by default", () => {
    const reg: GameRegistry = { a: fake("Alpha", 2, 2), b: fake("Beta", 1) };
    expect(gameSummaries(reg)).toEqual([
      { id: "a", name: "Alpha", minPlayers: 2, maxPlayers: 2, featured: true },
      { id: "b", name: "Beta", minPlayers: 1, maxPlayers: undefined, featured: true },
    ]);
  });

  it("honors an explicit featured set", () => {
    const reg: GameRegistry = { a: fake("Alpha", 2), b: fake("Beta", 1) };
    expect(gameSummaries(reg, new Set(["b"])).map((g) => [g.id, g.featured])).toEqual([
      ["a", false],
      ["b", true],
    ]);
  });
});
