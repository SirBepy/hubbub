import { createServer } from "./server.js";

const port = Number(process.env.PORT ?? 7787);
createServer(port);
console.log(`Hubbub server listening on ws://0.0.0.0:${port}`);
