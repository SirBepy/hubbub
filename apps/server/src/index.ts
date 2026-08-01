import { createServer } from "./server.js";
import { GAME_LOGICS as games } from "@hubbub/games";

const port = Number(process.env.PORT ?? 7787);
createServer(port, games);
console.log(`Hubbub server on ws://0.0.0.0:${port} (games: ${Object.keys(games).join(", ")})`);
