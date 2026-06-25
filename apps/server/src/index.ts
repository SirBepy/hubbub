import { createServer } from "./server.js";
import { tttLogic } from "@hubbub/game-tictactoe";
import { utttLogic } from "@hubbub/game-ultimate-tictactoe";
import type { GameRegistry } from "@hubbub/sdk";

const games: GameRegistry = { ttt: tttLogic, uttt: utttLogic };
const port = Number(process.env.PORT ?? 7787);
createServer(port, games);
console.log(`Hubbub server on ws://0.0.0.0:${port} (games: ${Object.keys(games).join(", ")})`);
