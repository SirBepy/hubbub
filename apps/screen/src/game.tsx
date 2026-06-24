import type { ComponentType } from "react";
import { TTTScreen } from "@hubbub/game-tictactoe/screen";
import { UTTTScreen } from "@hubbub/game-ultimate-tictactoe/screen";

type ScreenComponent = ComponentType<{ state: any }>;

const SCREENS: Record<string, ScreenComponent> = {
  ttt: TTTScreen as ScreenComponent,
  uttt: UTTTScreen as ScreenComponent,
};

const id = (import.meta.env.VITE_GAME as string) || "ttt";
export const GameScreen: ScreenComponent = SCREENS[id] ?? SCREENS.ttt;
