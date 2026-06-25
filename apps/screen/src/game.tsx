import type { ComponentType } from "react";
import { TTTScreen } from "@hubbub/game-tictactoe/screen";
import { UTTTScreen } from "@hubbub/game-ultimate-tictactoe/screen";

type ScreenComponent = ComponentType<{ state: any }>;

const SCREENS: Record<string, ScreenComponent> = {
  ttt: TTTScreen as ScreenComponent,
  uttt: UTTTScreen as ScreenComponent,
};

export function getScreen(gameId: string | null): ScreenComponent | null {
  return gameId ? SCREENS[gameId] ?? null : null;
}
