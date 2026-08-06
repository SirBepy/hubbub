import { describe, it, expect } from "vitest";
import { classifyConnectionTier, type StatsEntryLike } from "./ice-classify.js";

const pair = (over: Partial<StatsEntryLike> = {}): StatsEntryLike => ({
  type: "candidate-pair",
  state: "succeeded",
  localCandidateId: "l1",
  remoteCandidateId: "r1",
  ...over,
});
const candidate = (id: string, candidateType: string): StatsEntryLike => ({
  type: "local-candidate",
  id,
  candidateType,
});

describe("classifyConnectionTier", () => {
  it("both host candidates -> direct (LAN)", () => {
    const got = classifyConnectionTier([pair(), candidate("l1", "host"), candidate("r1", "host")]);
    expect(got).toEqual({ tier: "direct", detail: "host" });
  });

  it("srflx involved -> direct (internet P2P)", () => {
    const got = classifyConnectionTier([pair(), candidate("l1", "srflx"), candidate("r1", "host")]);
    expect(got).toEqual({ tier: "direct", detail: "srflx" });
  });

  it("prflx involved -> direct", () => {
    const got = classifyConnectionTier([pair(), candidate("l1", "prflx"), candidate("r1", "host")]);
    expect(got).toEqual({ tier: "direct", detail: "prflx" });
  });

  it("relay candidate type -> relay tier, even though a pair succeeded", () => {
    const got = classifyConnectionTier([pair(), candidate("l1", "relay"), candidate("r1", "host")]);
    expect(got).toEqual({ tier: "relay", detail: "relay" });
  });

  it("no successful or nominated pair -> relay", () => {
    const got = classifyConnectionTier([{ type: "candidate-pair", state: "failed" }]);
    expect(got).toEqual({ tier: "relay", detail: "none" });
  });

  it("falls back to a nominated pair when none is marked succeeded", () => {
    const got = classifyConnectionTier([
      pair({ state: "in-progress", nominated: true }),
      candidate("l1", "host"),
      candidate("r1", "host"),
    ]);
    expect(got).toEqual({ tier: "direct", detail: "host" });
  });

  it("pair references a candidate id that isn't present -> relay", () => {
    const got = classifyConnectionTier([pair(), candidate("l1", "host")]);
    expect(got).toEqual({ tier: "relay", detail: "none" });
  });

  it("empty stats -> relay", () => {
    expect(classifyConnectionTier([])).toEqual({ tier: "relay", detail: "none" });
  });
});
