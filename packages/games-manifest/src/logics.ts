// Register a game here = 3 lines total (this file + screens.ts + controllers.ts)
// plus one dependency in package.json. Keep the three keys in sync;
// manifest.test.ts enforces it.
import type { GameRegistry } from "@hubbub/sdk";
import { tttLogic } from "@hubbub/game-tictactoe";
import { utttLogic } from "@hubbub/game-ultimate-tictactoe";
import { tapRaceLogic } from "@hubbub/game-tap-race";
import { musicGuesserLogic } from "@hubbub/game-music-guesser";

export const GAME_LOGICS: GameRegistry = {
  ttt: tttLogic,
  uttt: utttLogic,
  "tap-race": tapRaceLogic,
  "music-guesser": musicGuesserLogic,
};

export const GAME_IDS = Object.keys(GAME_LOGICS);

export function getLogic(gameId: string | null) {
  return gameId ? GAME_LOGICS[gameId] ?? null : null;
}
