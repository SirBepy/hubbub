import { describe, it, expect } from "vitest";
import { isHotPathEligible, trySendOverChannel } from "./webrtc-transport.js";
import type { ClientMessage } from "./messages.js";

describe("isHotPathEligible", () => {
  it("only `action` is eligible for the DataChannel", () => {
    expect(isHotPathEligible({ t: "action", payload: { x: 1 } })).toBe(true);
  });

  it("everything else, including rtcSignal itself, stays off the channel", () => {
    const nonHot: ClientMessage[] = [
      { t: "attachScreen" },
      { t: "joinRoom", name: "Ann", colorId: 0, avatarId: "🦊" },
      { t: "returnToLobby" },
      { t: "gameStatePush", gameId: "g", state: {} },
      { t: "rtcSignal", data: { kind: "offer", sdp: {} } },
    ];
    for (const msg of nonHot) expect(isHotPathEligible(msg)).toBe(false);
  });
});

describe("trySendOverChannel", () => {
  it("returns true when the send succeeds", () => {
    expect(trySendOverChannel(() => {})).toBe(true);
  });

  it("returns false, never throws, when the send throws (channel closing mid-send)", () => {
    expect(() => trySendOverChannel(() => { throw new Error("channel closed"); })).not.toThrow();
    expect(trySendOverChannel(() => { throw new Error("channel closed"); })).toBe(false);
  });
});
