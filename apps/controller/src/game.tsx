import type { ComponentType } from "react";
import type { Player } from "@hubbub/protocol";
import type { GameLogic } from "@hubbub/sdk";
import { TTTController } from "@hubbub/game-tictactoe/controller";
import { tttLogic } from "@hubbub/game-tictactoe";
import { UTTTController } from "@hubbub/game-ultimate-tictactoe/controller";
import { utttLogic } from "@hubbub/game-ultimate-tictactoe";

type ControllerComponent = ComponentType<{ state: any; playerId: string; players: Player[]; send: (a: any) => void }>;

const CONTROLLERS: Record<string, ControllerComponent> = {
  ttt: TTTController as ControllerComponent,
  uttt: UTTTController as ControllerComponent,
};

// Per-game result() check for end-of-game controls (Rematch / Back to lobby).
const LOGICS: Record<string, GameLogic<any, any>> = {
  ttt: tttLogic,
  uttt: utttLogic,
};

export function getController(gameId: string | null): ControllerComponent | null {
  return gameId ? CONTROLLERS[gameId] ?? null : null;
}

export function getLogic(gameId: string | null): GameLogic<any, any> | null {
  return gameId ? LOGICS[gameId] ?? null : null;
}
