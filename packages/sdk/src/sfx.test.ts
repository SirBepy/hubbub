// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SfxEngine } from "./sfx.js";

/** Every test gets its own module instance: `sfx` is a module-level singleton, so reusing one
 * across tests would leak mute state and dedupe timestamps between them. */
async function freshSfx(): Promise<{ sfx: SfxEngine; storageKey: string }> {
  vi.resetModules();
  const mod = await import("./sfx.js");
  return { sfx: mod.sfx, storageKey: mod.SFX_STORAGE_KEY };
}

class FakeAudioParam {
  setValueAtTime = vi.fn();
  linearRampToValueAtTime = vi.fn();
  exponentialRampToValueAtTime = vi.fn();
}

function fakeNode() {
  return { connect: vi.fn(), disconnect: vi.fn(), addEventListener: vi.fn(), start: vi.fn(), stop: vi.fn() };
}

/** Just enough of the WebAudio surface for `buildVoice` to run without throwing: oscillator,
 * gain, filter, and noise-buffer nodes, plus resume()/state for the unlock handshake. */
class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  currentTime = 0;
  sampleRate = 44100;
  state: "suspended" | "running" | "closed" = "suspended";
  destination = {};
  oscillators: { type: string; frequency: FakeAudioParam }[] = [];

  constructor() {
    FakeAudioContext.instances.push(this);
  }
  createGain() {
    return { ...fakeNode(), gain: new FakeAudioParam() };
  }
  createBiquadFilter() {
    return { ...fakeNode(), type: "lowpass", frequency: new FakeAudioParam() };
  }
  createOscillator() {
    const osc = { ...fakeNode(), type: "sine", frequency: new FakeAudioParam() };
    this.oscillators.push(osc);
    return osc;
  }
  createBuffer(_channels: number, length: number, _sampleRate: number) {
    const data = new Float32Array(length);
    return { getChannelData: () => data };
  }
  createBufferSource() {
    return { ...fakeNode(), buffer: null, loop: false };
  }
  async resume() {
    this.state = "running";
  }
  async close() {
    this.state = "closed";
  }
}

beforeEach(() => {
  localStorage.clear();
  FakeAudioContext.instances = [];
});

afterEach(() => {
  delete (window as unknown as { AudioContext?: unknown }).AudioContext;
});

describe("sfx.play without a WebAudio implementation", () => {
  it("never throws, and reports unlocked=false", async () => {
    const { sfx } = await freshSfx();
    expect(() => sfx.play("pop")).not.toThrow();
    expect(() => sfx.play("fanfare", { index: 5, delayMs: 200 })).not.toThrow();
    expect(sfx.unlocked).toBe(false);
  });
});

describe("mute persistence", () => {
  it("persists setMuted under hubbub:sound, and a reloaded module reads it back", async () => {
    const { sfx, storageKey } = await freshSfx();
    expect(storageKey).toBe("hubbub:sound");
    expect(sfx.muted).toBe(false);

    sfx.setMuted(true);
    expect(localStorage.getItem(storageKey)).toBe("muted");

    const reloaded = await freshSfx();
    expect(reloaded.sfx.muted).toBe(true);
  });
});

describe("subscribe", () => {
  it("fires only on an actual mute change", async () => {
    const { sfx } = await freshSfx();
    const listener = vi.fn();
    const unsubscribe = sfx.subscribe(listener);

    sfx.setMuted(true);
    expect(listener).toHaveBeenCalledTimes(1);

    sfx.setMuted(true); // no-op: already muted
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    sfx.setMuted(false);
    expect(listener).toHaveBeenCalledTimes(1); // unsubscribed, so the flip back is not seen
  });
});

describe("with a fake AudioContext", () => {
  it("unlock() resolves true once the context is running", async () => {
    const { sfx } = await freshSfx();
    (window as unknown as { AudioContext: unknown }).AudioContext = FakeAudioContext;

    const resolved = await sfx.unlock();
    expect(resolved).toBe(true);
    expect(sfx.unlocked).toBe(true);
  });

  it("starts exactly one oscillator per pop, pitched higher for a higher stagger index", async () => {
    const { sfx } = await freshSfx();
    (window as unknown as { AudioContext: unknown }).AudioContext = FakeAudioContext;
    await sfx.unlock();
    const ctx = FakeAudioContext.instances[0]!;

    sfx.play("pop", { index: 0 });
    expect(ctx.oscillators).toHaveLength(1);
    const freqAtIndex0 = ctx.oscillators[0]!.frequency.setValueAtTime.mock.calls[0]![0] as number;

    sfx.play("pop", { index: 3 });
    expect(ctx.oscillators).toHaveLength(2);
    const freqAtIndex3 = ctx.oscillators[1]!.frequency.setValueAtTime.mock.calls[0]![0] as number;

    expect(freqAtIndex3).toBeGreaterThan(freqAtIndex0);
  });

  it("starts nothing while muted", async () => {
    const { sfx } = await freshSfx();
    (window as unknown as { AudioContext: unknown }).AudioContext = FakeAudioContext;
    await sfx.unlock();
    const ctx = FakeAudioContext.instances[0]!;

    sfx.setMuted(true);
    sfx.play("pop");
    sfx.play("fanfare");
    expect(ctx.oscillators).toHaveLength(0);
  });

  it("collapses two same-name calls inside the 25ms dedupe window, but lets pop stack", async () => {
    const { sfx } = await freshSfx();
    (window as unknown as { AudioContext: unknown }).AudioContext = FakeAudioContext;
    await sfx.unlock();
    const ctx = FakeAudioContext.instances[0]!;

    sfx.play("tick");
    sfx.play("tick", { delayMs: 10 }); // 10ms apart, inside the window: collapses to one
    expect(ctx.oscillators).toHaveLength(1);

    sfx.play("tick", { delayMs: 1000 }); // well outside the window: a fresh tick
    expect(ctx.oscillators).toHaveLength(2);

    sfx.play("pop", { delayMs: 0 });
    sfx.play("pop", { delayMs: 5 }); // "pop" is stackable: both start despite the 5ms gap
    expect(ctx.oscillators).toHaveLength(4);
  });
});
