// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { defineGameBundle } from "./bundle.js";
import { sfx } from "./sfx.js";

/** The frame's end of the shell's audio mirror: a message on the port must reach this document's
 * own sfx engine, because the frame's AudioContext is not the shell's. */
async function attachedPort() {
  const bundle = defineGameBundle({
    logic: {} as never,
    Screen: () => null,
    Controller: () => null,
  });
  const channel = new MessageChannel();
  bundle.attach({ root: document.createElement("div"), port: channel.port2, role: "screen" });
  return channel.port1;
}

afterEach(() => {
  sfx.setVolume(1);
  sfx.setMuted(false);
});

describe("defineGameBundle audio message", () => {
  it("applies the shell's volume and mute to the frame's own engine", async () => {
    const port = await attachedPort();
    port.postMessage({ t: "audio", muted: true, volume: 0.35 });
    await vi.waitFor(() => expect(sfx.volume).toBe(0.35));
    expect(sfx.muted).toBe(true);
    port.close();
  });

  it("still accepts the older mute-only shape from a shell without volume", async () => {
    const port = await attachedPort();
    sfx.setVolume(0.8);
    port.postMessage({ t: "audio", muted: true });
    await vi.waitFor(() => expect(sfx.muted).toBe(true));
    expect(sfx.volume).toBe(0.8);
    port.close();
  });

  it("resumes the frame's context when the shell reports it is unlocked", async () => {
    const unlock = vi.spyOn(sfx, "unlock").mockResolvedValue(true);
    const port = await attachedPort();
    port.postMessage({ t: "audio", muted: false, volume: 1, unlocked: true });
    await vi.waitFor(() => expect(unlock).toHaveBeenCalled());
    unlock.mockRestore();
    port.close();
  });
});
