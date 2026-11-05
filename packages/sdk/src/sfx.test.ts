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
  value = 1;
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
  gains: { gain: FakeAudioParam }[] = [];

  constructor() {
    FakeAudioContext.instances.push(this);
  }
  createGain() {
    const node = { ...fakeNode(), gain: new FakeAudioParam() };
    this.gains.push(node);
    return node;
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
    expect(JSON.parse(localStorage.getItem(storageKey)!)).toEqual({ volume: 1, muted: true });

    const reloaded = await freshSfx();
    expect(reloaded.sfx.muted).toBe(true);
  });

  it("still reads the bare string the engine wrote before volume existed", async () => {
    localStorage.setItem("hubbub:sound", "muted");
    expect((await freshSfx()).sfx.muted).toBe(true);

    localStorage.setItem("hubbub:sound", "on");
    const on = (await freshSfx()).sfx;
    expect(on.muted).toBe(false);
    expect(on.volume).toBe(1);
  });
});

describe("volume", () => {
  /** The engine's master node is the first gain it creates; every voice gain comes after. */
  async function unlockedEngine() {
    const { sfx } = await freshSfx();
    (window as unknown as { AudioContext: unknown }).AudioContext = FakeAudioContext;
    await sfx.unlock();
    const ctx = FakeAudioContext.instances[0]!;
    return { sfx, ctx, master: ctx.gains[0]!.gain };
  }

  it("defaults to full volume at exactly the engine's original gain of 0.5", async () => {
    const { sfx, master } = await unlockedEngine();
    expect(sfx.volume).toBe(1);
    expect(master.value).toBe(0.5);
  });

  it("scales the master gain, and a lower setting is quieter than a higher one", async () => {
    const { sfx, master } = await unlockedEngine();
    sfx.setVolume(0.5);
    const half = master.value;
    expect(half).toBeGreaterThan(0);
    expect(half).toBeLessThan(0.5);

    sfx.setVolume(0.25);
    expect(master.value).toBeLessThan(half);

    sfx.setVolume(0);
    expect(master.value).toBe(0);
  });

  it("applies a volume set before the context exists once the context is created", async () => {
    const { sfx } = await freshSfx();
    sfx.setVolume(0.4);
    (window as unknown as { AudioContext: unknown }).AudioContext = FakeAudioContext;
    await sfx.unlock();
    const master = FakeAudioContext.instances[0]!.gains[0]!.gain;
    expect(master.value).toBeGreaterThan(0);
    expect(master.value).toBeLessThan(0.5);
  });

  it("zeroes the master gain while muted and restores it on unmute", async () => {
    const { sfx, master } = await unlockedEngine();
    sfx.setVolume(0.8);
    const audible = master.value;

    sfx.setMuted(true);
    expect(master.value).toBe(0);

    sfx.setMuted(false);
    expect(master.value).toBe(audible);
  });

  it("round-trips through localStorage alongside mute", async () => {
    const { sfx, storageKey } = await freshSfx();
    sfx.setVolume(0.3);
    sfx.setMuted(true);
    expect(JSON.parse(localStorage.getItem(storageKey)!)).toEqual({ volume: 0.3, muted: true });

    const reloaded = (await freshSfx()).sfx;
    expect(reloaded.volume).toBe(0.3);
    expect(reloaded.muted).toBe(true);
  });

  it("clamps out-of-range setter values and ignores NaN", async () => {
    const { sfx } = await freshSfx();
    sfx.setVolume(7);
    expect(sfx.volume).toBe(1);
    sfx.setVolume(-3);
    expect(sfx.volume).toBe(0);
    sfx.setVolume(0.6);
    sfx.setVolume(Number.NaN);
    expect(sfx.volume).toBe(0.6);
  });

  it("reads garbage storage defensively: bad JSON, wrong types, out-of-range numbers", async () => {
    localStorage.setItem("hubbub:sound", "{not json");
    expect((await freshSfx()).sfx.volume).toBe(1);

    localStorage.setItem("hubbub:sound", JSON.stringify({ volume: "loud", muted: "yes" }));
    const wrongTypes = (await freshSfx()).sfx;
    expect(wrongTypes.volume).toBe(1);
    expect(wrongTypes.muted).toBe(false);

    localStorage.setItem("hubbub:sound", JSON.stringify({ volume: 9, muted: false }));
    expect((await freshSfx()).sfx.volume).toBe(1);

    localStorage.setItem("hubbub:sound", JSON.stringify({ volume: -2 }));
    expect((await freshSfx()).sfx.volume).toBe(0);

    localStorage.setItem("hubbub:sound", "null");
    expect((await freshSfx()).sfx.volume).toBe(1);
  });

  it("never throws when storage is unavailable", async () => {
    const { sfx } = await freshSfx();
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(() => {
      sfx.setVolume(0.2);
      sfx.setMuted(true);
    }).not.toThrow();
    expect(sfx.volume).toBe(0.2);
    setItem.mockRestore();

    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect((await freshSfx()).sfx.volume).toBe(1);
    getItem.mockRestore();
  });

  it("notifies subscribers on a volume change but not on a repeat", async () => {
    const { sfx } = await freshSfx();
    const listener = vi.fn();
    sfx.subscribe(listener);
    sfx.setVolume(0.5);
    sfx.setVolume(0.5);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe("installAutoUnlock", () => {
  it("resumes a suspended context on the first user gesture anywhere on the page", async () => {
    const { sfx } = await freshSfx();
    (window as unknown as { AudioContext: unknown }).AudioContext = FakeAudioContext;
    const dispose = sfx.installAutoUnlock();
    expect(sfx.unlocked).toBe(false);

    document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    await vi.waitFor(() => expect(sfx.unlocked).toBe(true));
    dispose();
  });

  it("keeps listening until a gesture actually unlocks, then removes itself", async () => {
    const { sfx } = await freshSfx();
    // A context that refuses the first resume() (a gesture Chrome did not count) and accepts the next.
    let attempts = 0;
    class StubbornContext extends FakeAudioContext {
      override async resume() {
        attempts += 1;
        if (attempts >= 2) this.state = "running";
      }
    }
    (window as unknown as { AudioContext: unknown }).AudioContext = StubbornContext;
    sfx.installAutoUnlock();

    document.dispatchEvent(new Event("pointerdown"));
    await vi.waitFor(() => expect(attempts).toBe(1));
    expect(sfx.unlocked).toBe(false);

    document.dispatchEvent(new Event("keydown"));
    await vi.waitFor(() => expect(sfx.unlocked).toBe(true));
    // resume() flips the state synchronously inside dispatch; the listener removal rides the
    // promise that follows it, so let that settle before the next gesture.
    await new Promise((r) => setTimeout(r, 10));

    document.dispatchEvent(new Event("click"));
    await new Promise((r) => setTimeout(r, 10));
    expect(attempts).toBe(2);
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
