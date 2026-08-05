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
  it("derives summaries from a registry", () => {
    const reg: GameRegistry = { a: fake("Alpha", 2, 2), b: fake("Beta", 1) };
    expect(gameSummaries(reg)).toEqual([
      { id: "a", name: "Alpha", minPlayers: 2, maxPlayers: 2 },
      { id: "b", name: "Beta", minPlayers: 1, maxPlayers: undefined },
    ]);
  });

  it("propagates category and identityColors from meta", () => {
    const reg: GameRegistry = {
      a: { ...fake("Alpha", 2, 2), meta: { name: "Alpha", minPlayers: 2, maxPlayers: 2, category: "Strategy", identityColors: [1, 0] } },
    };
    expect(gameSummaries(reg)).toEqual([
      { id: "a", name: "Alpha", minPlayers: 2, maxPlayers: 2, category: "Strategy", identityColors: [1, 0] },
    ]);
  });

  it("propagates aspectRatio from meta when declared", () => {
    const reg: GameRegistry = {
      a: { ...fake("Racer", 1, 4), meta: { name: "Racer", minPlayers: 1, maxPlayers: 4, aspectRatio: 16 / 9 } },
    };
    expect(gameSummaries(reg)[0].aspectRatio).toBe(16 / 9);
  });

  it("leaves aspectRatio undefined for a fluid game that omits it", () => {
    const reg: GameRegistry = { a: fake("Alpha", 2, 2) };
    expect(gameSummaries(reg)[0].aspectRatio).toBeUndefined();
  });
});
