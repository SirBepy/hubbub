// Eager registry, for the SERVER and host-desktop only. Node has no bundle budget, so importing
// every game's logic up front is free there. Browsers must use ./lazy.ts instead.
// Register a game = one entry here, one in lazy.ts, one dependency in package.json.
import type { GameRegistry } from "@hubbub/sdk";
import { tttLogic } from "@hubbub/game-tictactoe";
import { utttLogic } from "@hubbub/game-ultimate-tictactoe";
import { tapRaceLogic } from "@hubbub/game-tap-race";
import { musicGuesserLogic } from "@hubbub/game-music-guesser";
import { splitOpinionsLogic } from "@hubbub/game-split-opinions";

export const GAME_LOGICS: GameRegistry = {
  ttt: tttLogic,
  uttt: utttLogic,
  "tap-race": tapRaceLogic,
  "music-guesser": musicGuesserLogic,
  "split-opinions": splitOpinionsLogic,
};

export const GAME_IDS = Object.keys(GAME_LOGICS);

export function getLogic(gameId: string | null) {
  return gameId ? GAME_LOGICS[gameId] ?? null : null;
}
