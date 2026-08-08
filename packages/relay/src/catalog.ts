import type { GameSummary } from "@hubbub/protocol";
import type { GameCatalog, RelayPlayerInfo, RelaySettingsField } from "./types.js";

interface RegistryEntry {
  setup?(options: unknown, players: RelayPlayerInfo[]): unknown;
}

/** Pure mapping from a game registry to the GameCatalog shape Room needs. Summaries and
 * settingsSchema come in pre-computed so relay never has to import @hubbub/sdk or @hubbub/games. */
export function toCatalog(
  registry: Record<string, RegistryEntry>,
  summaries: GameSummary[],
  settingsSchema: (gameId: string) => RelaySettingsField[] | null,
): GameCatalog {
  return {
    summaries,
    settingsSchema,
    setup: async (gameId, options, players) => {
      const logic = registry[gameId];
      return logic?.setup ? await logic.setup(options, players) : undefined;
    },
  };
}
