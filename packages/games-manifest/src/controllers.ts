import type { ComponentType } from "react";
import type { Player } from "@hubbub/protocol";
import { TTTController } from "@hubbub/game-tictactoe/controller";
import { UTTTController } from "@hubbub/game-ultimate-tictactoe/controller";
import { TapRaceController } from "@hubbub/game-tap-race/controller";
import { MusicGuesserController } from "@hubbub/game-music-guesser/controller";

export type ControllerComponent = ComponentType<{ state: any; playerId: string; players: Player[]; send: (a: any) => void }>;

export const GAME_CONTROLLERS: Record<string, ControllerComponent> = {
  ttt: TTTController as ControllerComponent,
  uttt: UTTTController as ControllerComponent,
  "tap-race": TapRaceController as ControllerComponent,
  "music-guesser": MusicGuesserController as ControllerComponent,
};

export function getController(gameId: string | null): ControllerComponent | null {
  return gameId ? GAME_CONTROLLERS[gameId] ?? null : null;
}
