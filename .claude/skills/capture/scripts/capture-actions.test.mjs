import { createRequire } from "node:module";

const { waitIn } = createRequire(import.meta.url)("./capture-actions.cjs");

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
