import type { GameSummary } from "@hubbub/protocol";
import type { GameLogic } from "./types.js";

export type GameRegistry = Record<string, GameLogic<any, any>>;

export type { GameSummary };

export function gameSummaries(registry: GameRegistry): GameSummary[] {
  return Object.entries(registry).map(([id, game]) => ({
    id,
    name: game.meta.name,
    minPlayers: game.meta.minPlayers,
    maxPlayers: game.meta.maxPlayers,
    category: game.meta.category,
    description: game.meta.description,
    identityColors: game.meta.identityColors,
    aspectRatio: game.meta.aspectRatio,
  }));
}
