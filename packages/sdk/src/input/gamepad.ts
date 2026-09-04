import { useEffect, useRef, useState } from "react";
import type { InputLegendEntry } from "@hubbub/protocol";
import type { InputAction } from "./registry.js";

/** Standard-mapping face buttons, in the order registered actions bind to them. The glyph is a
 * label, not a hardware claim: a DualSense reports the same indices under different markings. */
export const GAMEPAD_FACE_BUTTONS = [
  { index: 0, glyph: "A" },
  { index: 1, glyph: "B" },
  { index: 2, glyph: "X" },
  { index: 3, glyph: "Y" },
] as const;

/** The legend the TV shows: registered actions paired with the button that fires them. Empty
 * when nothing is registered or no pad is attached, which is what keeps the tray off screen. */
export function inputLegendFor(actions: InputAction[], connected: boolean): InputLegendEntry[] {
  if (!connected) return [];
  return actions
    .slice(0, GAMEPAD_FACE_BUTTONS.length)
    .map((a, i) => ({ glyph: GAMEPAD_FACE_BUTTONS[i].glyph, label: a.label }));
}

/**
 * Binds the registered actions to the first attached gamepad and reports whether one is there.
 * The Gamepad API has no state-change event for buttons, so a poll is the only option; a browser
 * also hides pads until the user presses something, which is why `connected` starts false.
 */
export function useGamepadActions(actions: InputAction[]): boolean {
  const [connected, setConnected] = useState(false);
  const latest = useRef(actions);
  latest.current = actions;

  useEffect(() => {
    if (typeof navigator === "undefined" || typeof navigator.getGamepads !== "function") return;
    if (typeof requestAnimationFrame !== "function") return;
    let frame = 0;
    const down = new Set<number>();

    const tick = () => {
      const pad = Array.from(navigator.getGamepads()).find((p): p is Gamepad => p !== null);
      setConnected(!!pad);
      if (pad) {
        GAMEPAD_FACE_BUTTONS.forEach((button, i) => {
          const pressed = !!pad.buttons[button.index]?.pressed;
          if (pressed && !down.has(button.index)) {
            down.add(button.index);
            latest.current[i]?.run();
          } else if (!pressed) {
            down.delete(button.index);
          }
        });
      } else {
        down.clear();
      }
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  return connected;
}
