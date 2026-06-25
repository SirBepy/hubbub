import type { ComponentType } from "react";
import { TTTController } from "@hubbub/game-tictactoe/controller";
import { UTTTController } from "@hubbub/game-ultimate-tictactoe/controller";

type ControllerComponent = ComponentType<{ state: any; playerId: string; send: (a: any) => void }>;

const CONTROLLERS: Record<string, ControllerComponent> = {
  ttt: TTTController as ControllerComponent,
  uttt: UTTTController as ControllerComponent,
};

export function getController(gameId: string | null): ControllerComponent | null {
  return gameId ? CONTROLLERS[gameId] ?? null : null;
}
