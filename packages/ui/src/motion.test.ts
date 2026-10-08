// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { prefersReducedMotion, useInjectedStyles, vibrate } from "./motion";

afterEach(() => {
  vi.unstubAllGlobals();
  document.head.innerHTML = "";
});

describe("vibrate", () => {
  it("is a no-op where the Vibration API is missing", () => {
    expect("vibrate" in navigator).toBe(false);
    expect(() => vibrate(12)).not.toThrow();
  });

  it("passes the pattern through where the API exists", () => {
    const spy = vi.fn();
    vi.stubGlobal("navigator", { vibrate: spy });
    vibrate([10, 20]);
    expect(spy).toHaveBeenCalledWith([10, 20]);
  });
});

describe("prefersReducedMotion", () => {
  it("is false when matchMedia does not exist", () => {
    vi.stubGlobal("matchMedia", undefined);
    expect(prefersReducedMotion()).toBe(false);
  });

  it("reads the reduce query", () => {
    const query = vi.fn().mockReturnValue({ matches: true });
    vi.stubGlobal("matchMedia", query);
    expect(prefersReducedMotion()).toBe(true);
    expect(query).toHaveBeenCalledWith("(prefers-reduced-motion: reduce)");
  });
});

describe("useInjectedStyles", () => {
  it("appends one style tag per id across remounts", () => {
    renderHook(() => useInjectedStyles("motion-a", ".a{}")).unmount();
    renderHook(() => useInjectedStyles("motion-a", ".a{}"));
    renderHook(() => useInjectedStyles("motion-b", ".b{}"));
    const tags = document.head.querySelectorAll("style");
    expect(Array.from(tags).map((t) => [t.id, t.textContent])).toEqual([
      ["motion-a", ".a{}"],
      ["motion-b", ".b{}"],
    ]);
  });
});
