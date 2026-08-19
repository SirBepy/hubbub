// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { LOADER_MIN_VISIBLE_MS, LOADER_SHOW_AFTER_MS, useLoadingGate } from "./useLoadingGate";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useLoadingGate", () => {
  it("fast resolve commits the value and never shows the loader", async () => {
    vi.useFakeTimers();
    const load = vi.fn((key: string) => Promise.resolve(`data-${key}`));
    const { result } = renderHook(() => useLoadingGate("room-1", load));

    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(result.current.value).toBe("data-room-1");
    expect(result.current.showLoader).toBe(false);

    // Regression case: an uncleared show-timer would fire here and raise the
    // loader back over the already-committed value.
    await act(() => vi.advanceTimersByTimeAsync(LOADER_SHOW_AFTER_MS + 500));
    expect(result.current.showLoader).toBe(false);
    expect(result.current.value).toBe("data-room-1");
  });

  it("slow resolve shows the loader and holds it for the minimum visible time", async () => {
    vi.useFakeTimers();
    let resolveLoad!: (value: string) => void;
    const load = vi.fn(() => new Promise<string>((resolve) => { resolveLoad = resolve; }));
    const { result } = renderHook(() => useLoadingGate("room-2", load));

    expect(result.current.showLoader).toBe(false);
    await act(() => vi.advanceTimersByTimeAsync(LOADER_SHOW_AFTER_MS));
    expect(result.current.showLoader).toBe(true);
    expect(result.current.value).toBe(null);

    await act(async () => {
      resolveLoad("data-room-2");
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.showLoader).toBe(true);
    expect(result.current.value).toBe(null);

    await act(() => vi.advanceTimersByTimeAsync(LOADER_MIN_VISIBLE_MS - 1));
    expect(result.current.showLoader).toBe(true);

    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(result.current.showLoader).toBe(false);
    expect(result.current.value).toBe("data-room-2");
  });

  it("a key change mid-flight drops the stale load with no stale commit", async () => {
    vi.useFakeTimers();
    const resolvers: Record<string, (value: string) => void> = {};
    const load = vi.fn((key: string) => new Promise<string>((resolve) => { resolvers[key] = resolve; }));
    const { result, rerender } = renderHook(({ key }) => useLoadingGate(key, load), {
      initialProps: { key: "a" },
    });

    await act(() => vi.advanceTimersByTimeAsync(LOADER_SHOW_AFTER_MS));
    expect(result.current.showLoader).toBe(true);

    act(() => rerender({ key: "b" }));
    expect(result.current.showLoader).toBe(false);

    await act(async () => {
      resolvers.a("stale-a");
      await vi.advanceTimersByTimeAsync(LOADER_SHOW_AFTER_MS + LOADER_MIN_VISIBLE_MS + 1000);
    });
    expect(result.current.value).not.toBe("stale-a");

    await act(async () => {
      resolvers.b("fresh-b");
      await vi.advanceTimersByTimeAsync(LOADER_SHOW_AFTER_MS + LOADER_MIN_VISIBLE_MS);
    });
    expect(result.current.value).toBe("fresh-b");
  });

  it("rejection drops the loader instead of spinning forever", async () => {
    vi.useFakeTimers();
    vi.spyOn(console, "error").mockImplementation(() => {});
    let rejectLoad!: (err: Error) => void;
    const load = vi.fn(() => new Promise<string>((_resolve, reject) => { rejectLoad = reject; }));
    const { result } = renderHook(() => useLoadingGate("room-4", load));

    await act(() => vi.advanceTimersByTimeAsync(LOADER_SHOW_AFTER_MS));
    expect(result.current.showLoader).toBe(true);

    await act(async () => {
      rejectLoad(new Error("boom"));
      await vi.advanceTimersByTimeAsync(LOADER_MIN_VISIBLE_MS);
    });
    expect(result.current.showLoader).toBe(false);
    expect(result.current.value).toBe(null);
  });
});
