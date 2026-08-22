import { gameSummaries } from "@hubbub/sdk";
import { getSettingsSchema } from "@hubbub/games-manifest/settings";
import { GAME_LOGICS } from "@hubbub/games-manifest";
import { toCatalog } from "@hubbub/relay";

export const catalog = toCatalog(GAME_LOGICS, gameSummaries(GAME_LOGICS), getSettingsSchema);
