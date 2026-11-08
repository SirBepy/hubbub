import { describe, it, expect, afterEach, vi } from "vitest";
import { env, reset, evictDurableObject, runInDurableObject, runDurableObjectAlarm } from "cloudflare:test";
import { createRoom, attach, type Conn } from "./helpers.js";

// Not a catalogue game: the relay only checks that the room is in-game and the id matches, so
// seeding the room into that state keeps these tests independent of which sibling game repos
// happen to be cloned (the production catalogue is empty on a CI checkout).
const GAME_ID = "coalescing-fixture";

afterEach(async () => { await reset(); });

/** Joins two players, then puts the room into `in-game` for GAME_ID by rewriting its stored
 * snapshot and evicting the in-memory Room, so gameStatePush is legal (mode must be "in-game"
 * and gameId must match currentGameId) without launching a catalogue game. */
async function setupInGameRoom(): Promise<{ code: string; screen: Conn; p1: Conn; p2: Conn }> {
  const code = await createRoom();
  const screen = await attach(code);
  screen.ws.send(JSON.stringify({ t: "attachScreen" }));
  await screen.next(); // roomCreated
  await screen.next(); // roomState

  const p1 = await attach(code);
  p1.ws.send(JSON.stringify({ t: "joinRoom", name: "Bepy", colorId: 0, avatarId: "🐱" }));
  await p1.next(); // joined
  await p1.next(); // roomState
  await screen.next(); // roomState reflecting Bepy

  const p2 = await attach(code);
  p2.ws.send(JSON.stringify({ t: "joinRoom", name: "Mira", colorId: 1, avatarId: "🐶" }));
  await p2.next(); // joined
  await p2.next(); // roomState
  await screen.next(); // roomState reflecting Mira

  const stub = env.ROOM.get(env.ROOM.idFromName(code));
  await runInDurableObject(stub, async (instance, state) => {
    const snap = (await state.storage.get("room")) as Record<string, unknown>;
    await state.storage.put("room", { ...snap, mode: "in-game", currentGameId: GAME_ID });
    (instance as unknown as { room: undefined }).room = undefined; // next message reloads the seeded snapshot
  });
  return { code, screen, p1, p2 };
}

describe("gameStatePush write coalescing", () => {
  it("collapses N pushes into a single storage write, flushed by the alarm", async () => {
    const { code, screen } = await setupInGameRoom();
    const stub = env.ROOM.get(env.ROOM.idFromName(code));

    let putCount = 0;
    await runInDurableObject(stub, async (_instance, state) => {
      const storage = state.storage as unknown as { put: (...args: unknown[]) => Promise<unknown> };
      const real = storage.put.bind(storage);
      vi.spyOn(storage, "put").mockImplementation((...args: unknown[]) => {
        putCount++;
        return real(...args);
      });
    });

    const N = 20;
    for (let i = 0; i < N; i++) {
      screen.ws.send(JSON.stringify({ t: "gameStatePush", gameId: GAME_ID, state: { tick: i } }));
      await screen.next(); // gameState echo proves this push was fully handled before the next send
    }
    expect(putCount).toBe(0); // still coalescing - nothing flushed yet

    expect(await runDurableObjectAlarm(stub)).toBe(true);
    // Measured: 20 gameStatePush messages -> 1 storage.put() (before this change: 20).
    expect(putCount).toBe(1);
  });

  it("keeps membership and game durable across an eviction, but drops an un-flushed pending push", async () => {
    const { code, screen } = await setupInGameRoom();
    const stub = env.ROOM.get(env.ROOM.idFromName(code));

    screen.ws.send(JSON.stringify({ t: "gameStatePush", gameId: GAME_ID, state: { tick: "durable" } }));
    await screen.next();
    expect(await runDurableObjectAlarm(stub)).toBe(true); // flushed: "durable" is now in storage

    screen.ws.send(JSON.stringify({ t: "gameStatePush", gameId: GAME_ID, state: { tick: "pending" } }));
    await screen.next(); // processed in-memory, but its own alarm has not fired yet

    // Tears down the in-memory Room (holding "pending") while keeping storage (holding
    // "durable") and the still-scheduled alarm - a real mid-buffer eviction.
    await evictDurableObject(stub, { webSockets: "hibernate" });

    // The alarm armed before eviction survives it (setAlarm persists in storage) and still
    // fires on wake, re-flushing whatever storage actually has - "pending" is already gone.
    expect(await runDurableObjectAlarm(stub)).toBe(true);

    const p3 = await attach(code);
    p3.ws.send(JSON.stringify({ t: "joinRoom", name: "Kimi", colorId: 2, avatarId: "🐰" }));
    await p3.next(); // joined
    const stateMsg = await p3.next(); // roomState
    const cached = await p3.next(); // gameState replay from the rehydrated lastGameState cache

    // Guaranteed: membership and in-game mode survive the eviction untouched.
    expect(stateMsg.players.map((p: any) => p.name).sort()).toEqual(["Bepy", "Kimi", "Mira"]);
    expect(stateMsg.mode).toBe("in-game");
    // Best-effort: the pending push never reached storage - the rehydrated cache only has the
    // last value an actual flush wrote.
    expect(cached.state).toEqual({ tick: "durable" });
  });
});
