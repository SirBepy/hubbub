import { gameSummaries } from "@hubbub/sdk";
import { getSettingsSchema } from "@hubbub/games/settings";
import { GAME_LOGICS } from "@hubbub/games";
import type { GameCatalog } from "@hubbub/relay";

// Mirrors apps/server/src/server.ts's toCatalog() exactly (same @hubbub/games registry, same
// GameCatalog shape) - proof local and cloud never drift. No games were left out: none of
// ttt/uttt/tap-race/music-guesser import a Node built-in, so all four run in workerd unchanged.
export const catalog: GameCatalog = {
  summaries: gameSummaries(GAME_LOGICS),
  settingsSchema: (gameId) => getSettingsSchema(gameId),
  setup: async (gameId, options, players) => {
    const logic = GAME_LOGICS[gameId];
    return logic?.setup ? await logic.setup(options, players) : undefined;
  },
};
