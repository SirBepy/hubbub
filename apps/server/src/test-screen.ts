import type { WebSocket } from "ws";
import { createGameAuthority, type GameRegistry } from "@hubbub/sdk";

/** Wires a raw "screen" test socket to behave like the real apps/screen authority now that
 * server.ts only relays: builds a GameInstance from gameLaunch and pushes gameStatePush back
 * for both forwarded actions and its own local timeouts. Mirrors apps/screen/src/App.tsx. */
export function attachScreenAuthority(screenWs: WebSocket, games: GameRegistry) {
  let gameId: string | null = null;
  const authority = createGameAuthority((state) => {
    if (gameId) screenWs.send(JSON.stringify({ t: "gameStatePush", gameId, state }));
  });
  screenWs.on("message", (raw) => {
    const msg = JSON.parse(raw.toString());
    if (msg.t === "gameLaunch") {
      gameId = msg.gameId;
      authority.launch(games[msg.gameId], msg.players, msg.setupData, msg.now);
    } else if (msg.t === "gameAction") {
      authority.action(msg.playerId, msg.payload, msg.now);
    }
  });
  return authority;
}
