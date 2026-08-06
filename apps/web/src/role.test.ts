import { describe, it, expect } from "vitest";
import { decideInitialRole, getRoomCodeFromSearch } from "./role.js";

describe("getRoomCodeFromSearch", () => {
  it("reads ?room= off a search string", () => {
    expect(getRoomCodeFromSearch("?room=ABCD")).toBe("ABCD");
  });

  it("returns empty string when absent", () => {
    expect(getRoomCodeFromSearch("")).toBe("");
  });
});

describe("decideInitialRole", () => {
  it("a room code always wins, regardless of device or override", () => {
    const role = decideInitialRole({ roomCode: "ABCD", storedOverride: "screen", coarsePointer: false, viewportWidth: 1920 });
    expect(role).toBe("controller");
  });

  it("a stored override wins over the device heuristic", () => {
    const role = decideInitialRole({ roomCode: "", storedOverride: "controller", coarsePointer: false, viewportWidth: 1920 });
    expect(role).toBe("controller");
  });

  it("coarse pointer plus narrow viewport preselects controller", () => {
    const role = decideInitialRole({ roomCode: "", storedOverride: null, coarsePointer: true, viewportWidth: 390 });
    expect(role).toBe("controller");
  });

  it("defaults to screen for a mouse-driven wide viewport", () => {
    const role = decideInitialRole({ roomCode: "", storedOverride: null, coarsePointer: false, viewportWidth: 1920 });
    expect(role).toBe("screen");
  });
});
