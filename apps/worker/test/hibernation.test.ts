import { describe, it, expect, afterEach } from "vitest";
import { env, reset, evictDurableObject } from "cloudflare:test";
import { createRoom, attach } from "./helpers.js";

afterEach(async () => { await reset(); });

describe("Durable Object hibernation", () => {
  it("keeps room state and already-open sockets working after an eviction", async () => {
    const code = await createRoom();
    const screen = await attach(code);
    screen.ws.send(JSON.stringify({ t: "attachScreen" }));
    await screen.next(); // roomCreated
    await screen.next(); // roomState

    const p1 = await attach(code);
    p1.ws.send(JSON.stringify({ t: "joinRoom", name: "Bepy", colorId: 0, emoji: "🐱" }));
    await p1.next(); // joined
    await p1.next(); // roomState
    await screen.next(); // roomState reflecting Bepy

    // Tears down the DO's in-memory instance (Room object, codeFails counter) while keeping
    // ctx.storage and hibernating the still-open sockets - this is what a real idle DO does.
    const stub = env.ROOM.get(env.ROOM.idFromName(code));
    await evictDurableObject(stub, { webSockets: "hibernate" });

    const p2 = await attach(code);
    p2.ws.send(JSON.stringify({ t: "joinRoom", name: "Mira", colorId: 1, emoji: "🐶" }));
    await p2.next(); // joined
    const stateAfterP2 = await p2.next(); // roomState

    // Rehydrated from ctx.storage: Bepy (joined pre-eviction) is still known.
    expect(stateAfterP2.players.map((p: any) => p.name).sort()).toEqual(["Bepy", "Mira"]);

    // The pre-eviction screen socket is still live and reachable via state.getWebSockets() on
    // wake, not a since-cleared in-memory connId map.
    const screenSees = await screen.next();
    expect(screenSees.players.map((p: any) => p.name).sort()).toEqual(["Bepy", "Mira"]);
  });
});
