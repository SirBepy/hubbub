// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { useGamepadActions } from "./gamepad.js";
import type { InputAction } from "./registry.js";

/** Minimal fake covering the shape `useGamepadActions` reads: `buttons[].pressed` only. */
function fakeGamepad(pressed: boolean[]): Gamepad {
  return {
    id: "fake-pad",
    index: 0,
    connected: true,
    mapping: "standard",
    timestamp: 0,
    axes: [],
    hapticActuators: [],
    vibrationActuator: null,
    buttons: pressed.map((p) => ({ pressed: p, touched: p, value: p ? 1 : 0 })),
  } as unknown as Gamepad;
}

const action = (id: string, label: string, run: () => void): InputAction => ({ id, label, run });

describe("useGamepadActions", () => {
  let pads: Array<Gamepad | null> = [];
  let pending: Map<number, FrameRequestCallback>;
  let nextId: number;

  beforeEach(() => {
    pads = [];
    pending = new Map();
    nextId = 0;
    Object.defineProperty(navigator, "getGamepads", {
      value: () => pads,
      writable: true,
      configurable: true,
    });
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      const id = ++nextId;
      pending.set(id, cb);
      return id;
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => {
      pending.delete(id);
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  /** Fires every raf callback scheduled so far - one poll tick - then lets the hook re-schedule. */
  function tick() {
    const callbacks = Array.from(pending.values());
    pending.clear();
    act(() => callbacks.forEach((cb) => cb(0)));
  }

  it("connected starts false with no pad", () => {
    const { result } = renderHook(() => useGamepadActions([]));
    expect(result.current).toBe(false);
  });

  it("flips true once a pad appears", () => {
    const { result } = renderHook(() => useGamepadActions([]));
    tick();
    expect(result.current).toBe(false);
    pads = [fakeGamepad([false, false, false, false])];
    tick();
    expect(result.current).toBe(true);
  });

  it("a button press fires its bound action exactly once", () => {
    const run = vi.fn();
    pads = [fakeGamepad([false, false, false, false])];
    renderHook(() => useGamepadActions([action("a", "A", run)]));
    tick();
    pads = [fakeGamepad([true, false, false, false])];
    tick();
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("holding the button does not re-fire it", () => {
    const run = vi.fn();
    pads = [fakeGamepad([false, false, false, false])];
    renderHook(() => useGamepadActions([action("a", "A", run)]));
    tick();
    pads = [fakeGamepad([true, false, false, false])];
    tick();
    tick();
    tick();
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("cancels the raf loop on unmount", () => {
    pads = [];
    const { unmount } = renderHook(() => useGamepadActions([]));
    expect(pending.size).toBe(1);
    unmount();
    expect(pending.size).toBe(0);
  });
});
