import { PLAYER_COLORS, colorHex, colorName, hexToHsl, hslToHex, rgbToHsl, shadePair } from "./palette";

describe("hslToHex", () => {
  it("wraps hue in both directions", () => {
    expect(hslToHex(-30, 0.7, 0.5)).toBe(hslToHex(330, 0.7, 0.5));
    expect(hslToHex(400, 0.7, 0.5)).toBe(hslToHex(40, 0.7, 0.5));
  });

  it("wraps far past a single turn", () => {
    expect(hslToHex(720 + 120, 0.5, 0.4)).toBe(hslToHex(120, 0.5, 0.4));
  });
});

describe("rgbToHsl", () => {
  it("returns hue 0 for the achromatic case", () => {
    expect(rgbToHsl(128, 128, 128)).toEqual([0, 0, 128 / 255]);
  });

  it("round trips every player colour back to its own hex", () => {
    for (const c of PLAYER_COLORS) expect(hslToHex(...hexToHsl(c.hex))).toBe(c.hex.toLowerCase());
  });
});

describe("shadePair", () => {
  // Pinned literals, not recomputed from the maths: every shipped game's identity shading reads
  // these, so a change to the formula has to admit it is changing existing games' colours.
  const EXPECTED: Record<string, [string, string]> = {
    magenta: ["#D97BA8", "#a72c67"],
    cyan: ["#3E8F86", "#255a54"],
    lime: ["#5FA046", "#3a652a"],
    amber: ["#E4B33C", "#a07712"],
    violet: ["#8E6BC0", "#563584"],
    blue: ["#4C7FC0", "#294e7d"],
  };

  it.each(PLAYER_COLORS.map((c) => [c.name, c.hex] as const))("pins %s", (name, hex) => {
    expect(shadePair(hex)).toEqual(EXPECTED[name]);
  });

  it("keeps the source hex as the light half", () => {
    expect(shadePair("#D97BA8")[0]).toBe("#D97BA8");
  });
});

describe("colour id resolution", () => {
  it("cycles past the fixed six and handles negatives", () => {
    expect(colorHex(6)).toBe(colorHex(0));
    expect(colorName(-1)).toBe("blue");
  });
});
