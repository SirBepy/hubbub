import type { GameLogic } from "./types.js";

export type GameRegistry = Record<string, GameLogic<any, any>>;

export interface GameSummary {
  id: string;
  name: string;
  minPlayers: number;
  maxPlayers?: number;
  featured: boolean;
}

export function gameSummaries(registry: GameRegistry, featured?: Set<string>): GameSummary[] {
  return Object.entries(registry).map(([id, game]) => ({
    id,
    name: game.meta.name,
    minPlayers: game.meta.minPlayers,
    maxPlayers: game.meta.maxPlayers,
    featured: featured ? featured.has(id) : true,
  }));
}
