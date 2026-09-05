import { useEffect, useRef, type RefObject } from "react";
import type { WebRtcClientTransport } from "@hubbub/protocol/webrtc";
import type { GameResult } from "@hubbub/sdk";
import { createSandboxScreenAuthority, type SandboxScreenAuthority } from "./sandbox-authority";
import type { ScreenAuthority } from "./authority";

declare const __HUBBUB_DEV_LOADER__: boolean;
const DEV_LOADER = __HUBBUB_DEV_LOADER__;

// Long enough to read two lines from a sofa, short enough that nobody starts troubleshooting.
const FAILURE_DWELL_MS = 4_000;

export interface UseScreenAuthorityCallbacks {
  onResult: (result: GameResult | null) => void;
  /** Falls back to the last launch when the sandbox driver has no game of its own to report -
   * the sandbox frame can error before its `onConnect` ever hands over a `currentGameId()`. */
  getFallbackGameId: () => string | null;
  setFailedGameId: (gameId: string) => void;
}

export interface UseScreenAuthorityResult {
  authority: ScreenAuthority;
  sandboxRef: RefObject<SandboxScreenAuthority | null>;
  reportFailure: () => void;
}

/** Wraps whichever driver ends up running the game - direct or sandboxed - behind a queue so
 * calls made before it exists (inescapable: the direct driver arrives through a dynamic import,
 * the sandboxed one through a frame handshake) are replayed once it does. Also owns the two-beat
 * failure report: the first beat only announces, so the room's mode stays "in-game" and the host
 * cannot relaunch into the overlay everyone is still reading; the second returns the room to the
 * lobby once it has been read. */
export function useScreenAuthority(
  transportRef: RefObject<WebRtcClientTransport | undefined>,
  callbacks: UseScreenAuthorityCallbacks
): UseScreenAuthorityResult {
  const sandboxRef = useRef<SandboxScreenAuthority | null>(null);
  const reportFailureRef = useRef<() => void>(() => {});

  const driverRef = useRef<{ real: ScreenAuthority | null; queued: ((a: ScreenAuthority) => void)[] }>({
    real: null,
    queued: [],
  });
  const authority = useRef<ScreenAuthority>({
    launch: (...a) => {
      const d = driverRef.current;
      d.real ? d.real.launch(...a) : d.queued.push((r) => r.launch(...a));
    },
    action: (...a) => {
      const d = driverRef.current;
      d.real ? d.real.action(...a) : d.queued.push((r) => r.action(...a));
    },
    playersChanged: (...a) => {
      const d = driverRef.current;
      d.real ? d.real.playersChanged(...a) : d.queued.push((r) => r.playersChanged(...a));
    },
    reset: () => driverRef.current.real?.reset(),
  }).current;

  useEffect(() => {
    let cancelled = false;
    let failureTimer: ReturnType<typeof setTimeout> | null = null;

    function adopt(next: ScreenAuthority) {
      driverRef.current.real = next;
      for (const fn of driverRef.current.queued.splice(0)) fn(next);
    }

    const onFailure = () => {
      const gameId = sandboxRef.current?.currentGameId() ?? callbacks.getFallbackGameId();
      if (!gameId || failureTimer) return;
      callbacks.setFailedGameId(gameId);
      transportRef.current?.send({ t: "reportGameFailure", gameId });
      failureTimer = setTimeout(() => {
        failureTimer = null;
        transportRef.current?.send({ t: "returnFromFailure", gameId });
      }, FAILURE_DWELL_MS);
    };
    reportFailureRef.current = onFailure;

    const driverCallbacks = {
      onState: (gameId: string, state: unknown) => transportRef.current?.send({ t: "gameStatePush", gameId, state }),
      onResult: callbacks.onResult,
      onFailure,
    };

    if (DEV_LOADER) {
      import("./direct-authority").then((m) => { if (!cancelled) adopt(m.createDirectAuthority(driverCallbacks)); });
    } else {
      const sandbox = createSandboxScreenAuthority(driverCallbacks);
      sandboxRef.current = sandbox;
      adopt(sandbox);
    }

    return () => {
      cancelled = true;
      if (failureTimer) clearTimeout(failureTimer);
      authority.reset();
      sandboxRef.current = null;
    };
  }, []);

  return { authority, sandboxRef, reportFailure: () => reportFailureRef.current() };
}
