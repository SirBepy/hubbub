import { createServer } from "./server.js";
import { tttLogic } from "@hubbub/game-tictactoe";
import { utttLogic } from "@hubbub/game-ultimate-tictactoe";
import type { GameLogic } from "@hubbub/sdk";

const GAMES: Record<string, GameLogic<any, any>> = {
  ttt: tttLogic,
  uttt: utttLogic,
};

const gameId = process.env.HUBBUB_GAME ?? "ttt";
const game = GAMES[gameId] ?? tttLogic;

const port = Number(process.env.PORT ?? 7787);
createServer(port, game);
console.log(`Hubbub server listening on ws://0.0.0.0:${port} (game: ${gameId in GAMES ? gameId : "ttt"})`);
