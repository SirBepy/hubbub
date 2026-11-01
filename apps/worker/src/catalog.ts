import { gameSummaries, type GameRegistry } from "@hubbub/sdk";
import { getSettingsSchema } from "@hubbub/games-manifest/settings";
import { GAME_LOGICS, SANDBOX_GAME_IDS } from "@hubbub/games-manifest";
import { toCatalog } from "@hubbub/relay";

// The cloud runs every game in the sandbox origin's iframe, so a game with no built bundle to
// serve there would be listed and then fail to load. The local server keeps the full roster.
const sandboxLogics: GameRegistry = Object.fromEntries(
  Object.entries(GAME_LOGICS).filter(([id]) => SANDBOX_GAME_IDS.includes(id)),
);

export const catalog = toCatalog(sandboxLogics, gameSummaries(sandboxLogics), getSettingsSchema);
