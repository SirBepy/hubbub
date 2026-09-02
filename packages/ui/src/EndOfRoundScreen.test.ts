import { podiumOrder } from "./EndOfRoundScreen";
import type { EndOfRoundStandingRow } from "./EndOfRoundScreen";

const row = (position: number, name: string): EndOfRoundStandingRow => ({ position, name, avatarId: "a", score: "" });
const names = (rows: EndOfRoundStandingRow[]) => rows.map((r) => r.name);

describe("podiumOrder", () => {
  it("puts the winner in the middle and reads 2-1-3 left to right", () => {
    expect(names(podiumOrder([row(1, "first"), row(2, "second"), row(3, "third")]))).toEqual([
      "second",
      "first",
      "third",
    ]);
  });

  it("drops everyone below the third distinct position", () => {
    const rows = [row(1, "a"), row(2, "b"), row(3, "c"), row(4, "d"), row(5, "e")];
    expect(names(podiumOrder(rows)).sort()).toEqual(["a", "b", "c"]);
  });

  it("keeps both players tied for a position and leaves no third", () => {
    const out = podiumOrder([row(1, "a"), row(2, "b"), row(2, "c")]);
    expect(names(out)).toEqual(["b", "a", "c"]);
    expect(out.map((r) => r.position)).toEqual([2, 1, 2]);
  });

  it("counts a tie as one of the three distinct positions, not as two", () => {
    // Two 2nds plus a 3rd is still only three positions, so the 3rd survives.
    const out = podiumOrder([row(1, "a"), row(2, "b"), row(2, "c"), row(3, "d"), row(4, "e")]);
    expect(names(out).sort()).toEqual(["a", "b", "c", "d"]);
    expect(names(out)).not.toContain("e");
  });

  it("handles a single winner and an empty list without throwing", () => {
    expect(names(podiumOrder([row(1, "solo")]))).toEqual(["solo"]);
    expect(podiumOrder([])).toEqual([]);
  });
});
