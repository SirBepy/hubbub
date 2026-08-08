import { gameSummaries } from "@hubbub/sdk";
import { getSettingsSchema } from "@hubbub/games/settings";
import { GAME_LOGICS } from "@hubbub/games";
import { toCatalog } from "@hubbub/relay";

export const catalog = toCatalog(GAME_LOGICS, gameSummaries(GAME_LOGICS), getSettingsSchema);
