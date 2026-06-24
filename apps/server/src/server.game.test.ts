import { describe, it, expect, afterEach } from "vitest";
import { WebSocket } from "ws";
import { z } from "zod";
import type { GameLogic } from "@hubbub/sdk";
import { createServer } from "./server.js";

interface S { count: number; owner: string | null }
const game: GameLogic<S, { by: number }> = {
  meta: { name: "Counter", minPlayers: 1 },
  actionSchema: z.object({ by: z.number() }),
  init: (p) => ({ count: 0, owner: p[0]?.id ?? null }),
  onAction: (s, id, a) => (id === s.owner ? { ...s, count: s.count + a.by } : s),
  onPlayersChanged: (s, p) => (s.owner ? s : { ...s, owner: p[0]?.id ?? null }),
};

let handle: ReturnType<typeof createServer> | undefined;
afterEach(async () => await handle?.close());

const open = (port: number) =>
  new Promise<WebSocket>((res) => {
    const ws = new WebSocket(`ws://localhost:${port}`);
    ws.on("open", () => res(ws));
  });
const nextOf = (ws: WebSocket, t: string) =>
  new Promise<any>((res) => {
    const h = (m: any) => {
      const msg = JSON.parse(m.toString());
      if (msg.t === t) {
        ws.off("message", h);
        res(msg);
      }
    };
    ws.on("message", h);
  });

describe("createServer with a game", () => {
  it("broadcasts gameState on join and applies actions", async () => {
    handle = createServer(0, game);
    const port = (handle.wss.address() as { port: number }).port;

    const screen = await open(port);
    screen.send(JSON.stringify({ t: "createRoom" }));
    const created = await nextOf(screen, "roomCreated");

    const controller = await open(port);
    controller.send(JSON.stringify({ t: "joinRoom", code: created.code, name: "Joe" }));
    await nextOf(controller, "joined");

    const initial = await nextOf(screen, "gameState");
    expect(initial.state.count).toBe(0);

    controller.send(JSON.stringify({ t: "action", payload: { by: 3 } }));
    const after = await nextOf(screen, "gameState");
    expect(after.state.count).toBe(3);

    screen.close();
    controller.close();
  });
});
