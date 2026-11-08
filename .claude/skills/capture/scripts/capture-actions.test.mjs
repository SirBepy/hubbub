import { createRequire } from "node:module";

const { waitIn, clickMatch, pollUntil, fillSessionPlaceholder, NEVER_CLICK } = createRequire(import.meta.url)("./capture-actions.cjs");

// A page with no game frames whose waits resolve instantly, so a poll loop's cost is its number
// of checks rather than wall-clock time.
function fakePage() {
  return { frames: () => [], mainFrame: () => null, waitForTimeout: async () => {} };
}

function counter(matches) {
  const build = () => {
    build.calls++;
    return { count: async () => matches };
  };
  build.calls = 0;
  return build;
}

describe("NEVER_CLICK", () => {
  it("keeps a round-answering driver off the header's exit button", () => {
    expect(NEVER_CLICK.test("Exit game")).toBe(true);
  });

  it("still lets a round's own choices through", () => {
    expect(NEVER_CLICK.test("Billie Jean")).toBe(false);
  });
});

describe("waitIn", () => {
  it("with timeout 0, checks exactly once and returns null when nothing matches and required is false", async () => {
    const build = counter(0);
    expect(await waitIn(fakePage(), build, { timeoutMs: 0, required: false })).toBeNull();
    expect(build.calls).toBe(1);
  });

  it("with timeout 0, still finds a match on that one check", async () => {
    const build = counter(1);
    expect(await waitIn(fakePage(), build, { timeoutMs: 0 })).not.toBeNull();
    expect(build.calls).toBe(1);
  });

  it("throws on a miss unless required is false", async () => {
    await expect(waitIn(fakePage(), counter(0), { timeoutMs: 0, errorMsg: "nothing" })).rejects.toThrow("nothing");
  });
});

// A locator over `matches` elements (a number, or a function returning the count at each look)
// that records which element got which kind of click.
function stubLocator(matches) {
  const calls = [];
  const total = typeof matches === "function" ? matches : () => matches;
  const element = (i) => ({
    count: async () => (i < total() ? 1 : 0),
    click: async (opts) => calls.push({ i, kind: "click", force: opts.force }),
    dispatchEvent: async (type) => calls.push({ i, kind: `dispatch:${type}` }),
  });
  const loc = { first: () => element(0), nth: (i) => element(i) };
  return { build: () => loc, calls };
}

describe("clickMatch", () => {
  it("clicks the first match with a pointer click, forced only when asked", async () => {
    const { build, calls } = stubLocator(2);
    await clickMatch(fakePage(), build, {});
    await clickMatch(fakePage(), build, { force: true });
    expect(calls).toEqual([
      { i: 0, kind: "click", force: false },
      { i: 0, kind: "click", force: true },
    ]);
  });

  it("dispatches a DOM click instead of a pointer click when dispatch is set", async () => {
    const { build, calls } = stubLocator(1);
    await clickMatch(fakePage(), build, { dispatch: true, force: true });
    expect(calls).toEqual([{ i: 0, kind: "dispatch:click" }]);
  });

  it("clicks the indexed match for clickNth", async () => {
    const { build, calls } = stubLocator(3);
    expect(await clickMatch(fakePage(), build, {}, 2)).toBe(true);
    expect(calls).toEqual([{ i: 2, kind: "click", force: false }]);
  });

  it("skips an optional clickNth whose index is past the match count instead of waiting on it", async () => {
    const { build, calls } = stubLocator(1);
    expect(await clickMatch(fakePage(), build, { required: false, timeout: 0 }, 2)).toBe(false);
    expect(calls).toEqual([]);
  });

  it("keeps waiting while a list grows toward the clickNth index", async () => {
    let looks = 0;
    const { build, calls } = stubLocator(() => (++looks < 3 ? 1 : 3));
    expect(await clickMatch(fakePage(), build, { required: false, timeout: 5000 }, 2)).toBe(true);
    expect(calls).toEqual([{ i: 2, kind: "click", force: false }]);
  });

  it("skips an optional click when nothing matches", async () => {
    const { build, calls } = stubLocator(0);
    expect(await clickMatch(fakePage(), build, { required: false, timeout: 0 })).toBe(false);
    expect(calls).toEqual([]);
  });
});

describe("pollUntil", () => {
  afterEach(() => vi.useRealTimers());

  it("gives up after a default deadline when no timeout is passed", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    // Each wait advances the faked clock, so the loop ends on the fallback deadline rather than
    // wall-clock time; the call cap turns a missing fallback into a fast failure, not a hang.
    const page = { waitForTimeout: async (ms) => vi.advanceTimersByTime(ms) };
    let calls = 0;
    const predicate = () => {
      if (++calls > 1000) throw new Error("polled forever");
      return false;
    };
    expect(await pollUntil(page, predicate, { required: false })).toBeNull();
    expect(calls).toBeLessThan(1000);
  });
});

describe("fillSessionPlaceholder", () => {
  it("swaps the SESSION segment in out and shot paths for the session id", () => {
    const steps = [
      { type: "screenshot", page: "tv", out: ".for_bepy/screenshots/SESSION/tv.png" },
      { type: "identity", page: "p1", shot: ".for_bepy\\screenshots\\SESSION\\p1.png" },
    ];
    expect(fillSessionPlaceholder(steps, "123-456")).toEqual([
      { type: "screenshot", page: "tv", out: ".for_bepy/screenshots/123-456/tv.png" },
      { type: "identity", page: "p1", shot: ".for_bepy\\screenshots\\123-456\\p1.png" },
    ]);
  });

  it("leaves paths where SESSION is only part of a segment", () => {
    const steps = [{ type: "screenshot", out: "shots/SESSIONS/x.png" }];
    expect(fillSessionPlaceholder(steps, "123-456")).toEqual(steps);
  });

  it("throws naming the step when a placeholder is used without a session id", () => {
    const steps = [{ type: "wait", ms: 1 }, { type: "screenshot", out: "a/SESSION/b.png" }];
    expect(() => fillSessionPlaceholder(steps, null)).toThrow(/Step 1 \(screenshot\)/);
  });

  it("passes placeholder-free plans through without a session id", () => {
    const steps = [{ type: "screenshot", out: "out/tv.png" }];
    expect(fillSessionPlaceholder(steps, null)).toEqual(steps);
  });
});
