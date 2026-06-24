import { describe, it, expect, afterEach } from "vitest";
import { WebSocket } from "ws";
import { utttLogic } from "@hubbub/game-ultimate-tictactoe";
import { createServer } from "./server.js";

let handle: ReturnType<typeof createServer> | undefined;
afterEach(async () => await handle?.close());

const open = (port: number) =>
  new Promise<WebSocket>((res, rej) => {
    const ws = new WebSocket(`ws://localhost:${port}`);
    ws.on("open", () => res(ws));
    ws.on("error", rej);
  });
const nextOf = (ws: WebSocket, t: string) =>
  new Promise<any>((res, rej) => {
    const timer = setTimeout(() => rej(new Error(`timed out waiting for "${t}"`)), 4000);
    const h = (m: any) => {
      const msg = JSON.parse(m.toString());
      if (msg.t === t) {
        clearTimeout(timer);
        ws.off("message", h);
        res(msg);
      }
    };
    ws.on("message", h);
  });

describe("createServer with Ultimate Tic-Tac-Toe", () => {
  it("broadcasts initial state, applies a move, and updates the forced board", async () => {
    handle = createServer(0, utttLogic);
    const port = (handle.wss.address() as { port: number }).port;

    const screen = await open(port);
    screen.send(JSON.stringify({ t: "createRoom" }));
    const created = await nextOf(screen, "roomCreated");

    const controller = await open(port);
    controller.send(JSON.stringify({ t: "joinRoom", code: created.code, name: "Ann" }));
    await nextOf(controller, "joined");

    const initial = await nextOf(screen, "gameState");
    expect(initial.state.boards).toHaveLength(9);
    expect(initial.state.activeBoard).toBeNull();
    expect(initial.state.turn).toBe("X");

    // The first joiner is X; play board 4, cell 2.
    controller.send(JSON.stringify({ t: "action", payload: { board: 4, cell: 2 } }));
    const after = await nextOf(screen, "gameState");
    expect(after.state.boards[4][2]).toBe("X");
    expect(after.state.turn).toBe("O");
    expect(after.state.activeBoard).toBe(2);

    screen.close();
    controller.close();
  });
});
