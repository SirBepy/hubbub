import { describe, it, expect, afterEach } from "vitest";
import { reset } from "cloudflare:test";
import { createRoom, attach } from "./helpers.js";

afterEach(async () => { await reset(); });

describe("room lobby, through the real Worker + Durable Object", () => {
  it("creates a room, joins two players, and reaches lobby state", async () => {
    const code = await createRoom();
    expect(code).toMatch(/^[A-Z0-9]{4}$/);

    const screen = await attach(code);
    screen.ws.send(JSON.stringify({ t: "attachScreen" }));
    expect(await screen.next()).toEqual({ t: "roomCreated", code, screenToken: expect.any(String) });
    await screen.next(); // initial roomState broadcast

    const p1 = await attach(code);
    p1.ws.send(JSON.stringify({ t: "joinRoom", name: "Bepy", colorId: 0, avatarId: "🐱" }));
    expect((await p1.next()).t).toBe("joined");
    await p1.next(); // roomState reaching the joiner
    let state = await screen.next(); // roomState reaching the screen
    expect(state.players.map((p: any) => p.name)).toEqual(["Bepy"]);
    expect(state.mode).toBe("lobby");
    expect(state.games.length).toBeGreaterThan(0); // the real @hubbub/games-manifest catalog, not a stub

    const p2 = await attach(code);
    p2.ws.send(JSON.stringify({ t: "joinRoom", name: "Mira", colorId: 1, avatarId: "🐶" }));
    expect((await p2.next()).t).toBe("joined");
    await p2.next();
    state = await screen.next();
    expect(state.players.map((p: any) => p.name).sort()).toEqual(["Bepy", "Mira"]);
    expect(state.hostId).toBe(state.players.find((p: any) => p.name === "Bepy").id);
  });
});
