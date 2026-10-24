import { createRequire } from "node:module";

const { waitIn, clickMatch } = createRequire(import.meta.url)("./capture-actions.cjs");

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
