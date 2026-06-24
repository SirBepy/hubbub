import { createServer } from "./server.js";
import { tttLogic } from "@hubbub/game-tictactoe";

const port = Number(process.env.PORT ?? 7787);
createServer(port, tttLogic);
console.log(`Hubbub server listening on ws://0.0.0.0:${port}`);
