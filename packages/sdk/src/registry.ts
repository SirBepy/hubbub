import type { GameSummary } from "@hubbub/protocol";
import type { GameLogic } from "./types.js";

export type GameRegistry = Record<string, GameLogic<any, any>>;

export type { GameSummary };

export function gameSummaries(registry: GameRegistry, featured?: Set<string>): GameSummary[] {
  return Object.entries(registry).map(([id, game]) => ({
    id,
    name: game.meta.name,
    minPlayers: game.meta.minPlayers,
    maxPlayers: game.meta.maxPlayers,
    featured: featured ? featured.has(id) : true,
  }));
}
