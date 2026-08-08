import { describe, it, expect } from "vitest";
import { hostLabelFontScale } from "./host-label-scale";

describe("hostLabelFontScale", () => {
  it("leaves the baseline local host at full size", () => {
    expect(hostLabelFontScale("LOCALHOST:5175")).toBe(1);
  });

  it("leaves anything shorter than the baseline at full size", () => {
    expect(hostLabelFontScale("HUBBUB.TV")).toBe(1);
  });

  it("shrinks a long workers.dev host proportionally to its length", () => {
    const label = "HUBBUB.TABSXLABS.WORKERS.DEV";
    expect(hostLabelFontScale(label)).toBeCloseTo(14 / label.length);
    expect(hostLabelFontScale(label)).toBeLessThan(1);
  });
});
