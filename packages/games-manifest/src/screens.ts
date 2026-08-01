import type { ComponentType } from "react";
import type { Player } from "@hubbub/protocol";
import { TTTScreen } from "@hubbub/game-tictactoe/screen";
import { UTTTScreen } from "@hubbub/game-ultimate-tictactoe/screen";
import { TapRaceScreen } from "@hubbub/game-tap-race/screen";
import { MusicGuesserScreen } from "@hubbub/game-music-guesser/screen";

export type ScreenComponent = ComponentType<{ state: any; players: Player[] }>;

export const GAME_SCREENS: Record<string, ScreenComponent> = {
  ttt: TTTScreen as ScreenComponent,
  uttt: UTTTScreen as ScreenComponent,
  "tap-race": TapRaceScreen as ScreenComponent,
  "music-guesser": MusicGuesserScreen as ScreenComponent,
};

export function getScreen(gameId: string | null): ScreenComponent | null {
  return gameId ? GAME_SCREENS[gameId] ?? null : null;
}
