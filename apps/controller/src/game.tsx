import type { ComponentType } from "react";
import { TTTController } from "@hubbub/game-tictactoe/controller";
import { UTTTController } from "@hubbub/game-ultimate-tictactoe/controller";

type ControllerComponent = ComponentType<{
  state: any;
  playerId: string;
  send: (a: any) => void;
}>;

const CONTROLLERS: Record<string, ControllerComponent> = {
  ttt: TTTController as ControllerComponent,
  uttt: UTTTController as ControllerComponent,
};

const id = (import.meta.env.VITE_GAME as string) || "ttt";
export const GameController: ControllerComponent = CONTROLLERS[id] ?? CONTROLLERS.ttt;
