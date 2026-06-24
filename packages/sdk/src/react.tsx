import { useEffect, useState } from "react";
import type { ClientTransport } from "@hubbub/protocol";

// Subscribes to gameState broadcasts and returns the latest state (or null).
export function useGameState<State>(transport: ClientTransport | null): State | null {
  const [state, setState] = useState<State | null>(null);
  useEffect(() => {
    if (!transport) return;
    return transport.onMessage((msg) => {
      if (msg.t === "gameState") setState(msg.state as State);
    });
  }, [transport]);
  return state;
}

// Returns a typed sender that wraps an action object in the protocol envelope.
export function createActionSender<Action>(
  transport: ClientTransport
): (action: Action) => void {
  return (action: Action) => transport.send({ t: "action", payload: action });
}
