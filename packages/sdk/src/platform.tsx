import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

/** Platform-owned actions a game's own controller view can offer (rematch, leave the match).
 * The platform draws no buttons for these; the game does, so each game fits them into its look. */
export type PlatformAction = "rematch" | "returnToLobby";

export interface PlatformControls {
  /** Only the host's phone may rematch or return to the lobby; the server enforces it too. */
  isHost: boolean;
  /** True briefly after `rematch()`, so the game can show the press registered. */
  rematchPending: boolean;
  /** Restarts the current game with the same settings. No-op for a non-host or while pending. */
  rematch(): void;
  /** Ends the match and sends the room back to the lobby. No-op for a non-host. */
  returnToLobby(): void;
}

// Mirrors the relay's rematch cooldown: the relay drops repeats inside it, so the control stays
// "pending" for the same span and a mashed button visibly does nothing further.
export const REMATCH_PENDING_MS = 2_000;

const INERT: PlatformControls = { isHost: false, rematchPending: false, rematch() {}, returnToLobby() {} };

const PlatformContext = createContext<PlatformControls>(INERT);

/** Reads the platform actions inside a game's controller view. Outside a provider (a unit test
 * rendering the view bare) every action is an inert no-op and `isHost` is false. */
export function usePlatform(): PlatformControls {
  return useContext(PlatformContext);
}

/** Wired by whatever hosts a controller view (the phone app, or a sandboxed bundle's frame). */
export function PlatformProvider({
  isHost,
  onAction,
  children,
}: {
  isHost: boolean;
  onAction: (action: PlatformAction) => void;
  children?: ReactNode;
}) {
  const [rematchPending, setPending] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  // onAction changes identity every render of the host; read it through a ref so the controls
  // object (and every consumer) stays stable.
  const act = useRef(onAction);
  act.current = onAction;

  const rematch = useCallback(() => {
    if (!isHost || rematchPending) return;
    setPending(true);
    timer.current = setTimeout(() => setPending(false), REMATCH_PENDING_MS);
    act.current("rematch");
  }, [isHost, rematchPending]);

  const returnToLobby = useCallback(() => {
    if (isHost) act.current("returnToLobby");
  }, [isHost]);

  const value = useMemo(() => ({ isHost, rematchPending, rematch, returnToLobby }), [isHost, rematchPending, rematch, returnToLobby]);
  return createElement(PlatformContext.Provider, { value }, children);
}
