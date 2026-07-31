import type { ComponentType } from "react";
import type { Player } from "@hubbub/protocol";
import type { GameLogic } from "@hubbub/sdk";
import { TTTScreen } from "@hubbub/game-tictactoe/screen";
import { tttLogic } from "@hubbub/game-tictactoe";
import { UTTTScreen } from "@hubbub/game-ultimate-tictactoe/screen";
import { utttLogic } from "@hubbub/game-ultimate-tictactoe";

type ScreenComponent = ComponentType<{ state: any; players: Player[] }>;

const SCREENS: Record<string, ScreenComponent> = {
  ttt: TTTScreen as ScreenComponent,
  uttt: UTTTScreen as ScreenComponent,
};

const LOGICS: Record<string, GameLogic<any, any>> = {
  ttt: tttLogic,
  uttt: utttLogic,
};

export function getScreen(gameId: string | null): ScreenComponent | null {
  return gameId ? SCREENS[gameId] ?? null : null;
}

export function getLogic(gameId: string | null): GameLogic<any, any> | null {
  return gameId ? LOGICS[gameId] ?? null : null;
}
