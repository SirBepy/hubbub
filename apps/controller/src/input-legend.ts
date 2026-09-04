import { useEffect, useMemo, useRef } from "react";
import type { WebRtcClientTransport } from "@hubbub/protocol/webrtc";
import {
  inputLegendFor,
  useGamepadActions,
  useInputActions,
  type InputLegendEntry,
} from "@hubbub/sdk/input";

function sameLegend(a: InputLegendEntry[] | null, b: InputLegendEntry[]): boolean {
  if (!a || a.length !== b.length) return false;
  return a.every((entry, i) => entry.glyph === b[i].glyph && entry.label === b[i].label);
}

// The legend recomputes every frame the pad is polled, so the last published value is held in a
// ref; leaving the room clears it so a rejoin republishes.
export function usePublishInputLegend(
  transportRef: { current: WebRtcClientTransport | undefined },
  status: string,
) {
  const registeredActions = useInputActions();
  const gamepadConnected = useGamepadActions(registeredActions);
  const legend = useMemo(
    () => inputLegendFor(registeredActions, gamepadConnected),
    [registeredActions, gamepadConnected],
  );
  const lastSent = useRef<InputLegendEntry[] | null>(null);

  useEffect(() => {
    if (status !== "in") {
      lastSent.current = null;
      return;
    }
    if (sameLegend(lastSent.current, legend)) return;
    lastSent.current = legend;
    transportRef.current?.send({ t: "inputLegend", entries: legend });
  }, [legend, status, transportRef]);
}
