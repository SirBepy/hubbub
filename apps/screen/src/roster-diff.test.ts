import { describe, it, expect } from "vitest";
import { rosterIdsChanged } from "./roster-diff.js";

describe("rosterIdsChanged", () => {
  it("reports no change on the first message (no baseline yet)", () => {
    expect(rosterIdsChanged(null, new Set(["p1"]))).toBe(false);
  });

  it("reports no change on a reconnect (same id set)", () => {
    expect(rosterIdsChanged(new Set(["p1", "p2"]), new Set(["p1", "p2"]))).toBe(false);
  });

  it("reports change when a player id is added", () => {
    expect(rosterIdsChanged(new Set(["p1"]), new Set(["p1", "p2"]))).toBe(true);
  });

  it("reports change when a player id is removed", () => {
    expect(rosterIdsChanged(new Set(["p1", "p2"]), new Set(["p1"]))).toBe(true);
  });
});
