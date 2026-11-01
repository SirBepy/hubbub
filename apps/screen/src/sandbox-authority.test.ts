import { describe, it, expect, vi } from "vitest";
import type { SandboxBridge } from "@hubbub/sandbox";
import type { DisplayPlayer } from "@hubbub/sdk";
import { createSandboxScreenAuthority } from "./sandbox-authority.js";

const players = [{ id: "p1", name: "Bepy" }] as unknown as DisplayPlayer[];

function fakeBridge() {
  return { send: vi.fn(), close: vi.fn() } satisfies SandboxBridge;
}

function callbacks() {
  return { onState: vi.fn(), onResult: vi.fn(), onFailure: vi.fn() };
}

const launches = (b: ReturnType<typeof fakeBridge>) =>
  b.send.mock.calls.map(([m]) => m).filter((m) => m.t === "launch");

describe("createSandboxScreenAuthority", () => {
  // The frame's onConnect can beat gameLaunch off the wire: a warm frame connects before the
  // relay finishes setup. The launch must still reach that frame, or the TV sits on "Loading".
  it("delivers a launch that arrives after the frame already connected", () => {
    const authority = createSandboxScreenAuthority(callbacks());
    const bridge = fakeBridge();
    authority.attach(bridge);
    authority.launch("split-opinions", players, { seed: 1 }, 1000);
    expect(launches(bridge)).toEqual([{ t: "launch", players, setupData: { seed: 1 }, now: 1000 }]);
    expect(authority.currentGameId()).toBe("split-opinions");
  });

  it("replays a launch that arrived before the frame connected", () => {
    const authority = createSandboxScreenAuthority(callbacks());
    const bridge = fakeBridge();
    authority.launch("music-guesser", players, null, 5);
    expect(launches(bridge)).toEqual([]);
    authority.attach(bridge);
    expect(launches(bridge)).toEqual([{ t: "launch", players, setupData: null, now: 5 }]);
  });

  it("routes frame messages to the launched game's callbacks", () => {
    const cb = callbacks();
    const authority = createSandboxScreenAuthority(cb);
    authority.attach(fakeBridge());
    authority.launch("tap-race", players, null, 0);
    authority.handle({ t: "state", state: { n: 1 } });
    expect(cb.onState).toHaveBeenCalledWith("tap-race", { n: 1 });
  });

  // reset() is the return to the lobby, which unmounts the frame and closes its bridge, so the
  // next game must wait for its own frame's attach rather than post into the closed one.
  it("does not send a later launch into a bridge from before reset", () => {
    const authority = createSandboxScreenAuthority(callbacks());
    const old = fakeBridge();
    authority.attach(old);
    authority.launch("tap-race", players, null, 0);
    authority.reset();
    authority.launch("tap-race", players, null, 1);
    expect(launches(old)).toHaveLength(1);
    const fresh = fakeBridge();
    authority.attach(fresh);
    expect(launches(fresh)).toEqual([{ t: "launch", players, setupData: null, now: 1 }]);
  });
});
