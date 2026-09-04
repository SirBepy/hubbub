import { describe, it, expect } from "vitest";
import { GAMEPAD_FACE_BUTTONS, inputLegendFor } from "./gamepad.js";
import type { InputAction } from "./registry.js";

const action = (id: string, label: string): InputAction => ({ id, label, run: () => {} });

describe("inputLegendFor", () => {
  it("is empty with no pad, so a phones-only room never gets a tray", () => {
    expect(inputLegendFor([action("rematch", "Rematch")], false)).toEqual([]);
  });

  it("pairs actions with face buttons in registration order", () => {
    expect(inputLegendFor([action("rematch", "Rematch"), action("back", "Back to lobby")], true)).toEqual([
      { glyph: "A", label: "Rematch" },
      { glyph: "B", label: "Back to lobby" },
    ]);
  });

  it("drops actions past the last face button rather than binding them to nothing", () => {
    const many = Array.from({ length: 6 }, (_, i) => action(`a${i}`, `Action ${i}`));
    const legend = inputLegendFor(many, true);
    expect(legend).toHaveLength(GAMEPAD_FACE_BUTTONS.length);
    expect(legend.at(-1)).toEqual({ glyph: "Y", label: "Action 3" });
  });
});
