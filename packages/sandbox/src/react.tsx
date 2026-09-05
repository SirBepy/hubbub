import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { FrameToShell, SandboxRole } from "@hubbub/sdk/bridge";
import { assertDistinctOrigin, connectSandbox, sandboxFrameUrl, type SandboxBridge } from "./shell.js";

export interface SandboxFrameProps {
  base: string;
  gameId: string;
  /** Content hash of the approved bundle; `dev` on the local loop, which has no hash to quote. */
  version: string;
  role: SandboxRole;
  /** Bootstrap roster, `{id,name}` only - it crosses the one `"*"` postMessage. */
  players: { id: string; name: string }[];
  onConnect(bridge: SandboxBridge): void;
  onMessage(msg: FrameToShell): void;
  onError(reason: string): void;
}

const FRAME_STYLE: CSSProperties = { width: "100%", height: "100%", border: 0, display: "block" };

/** Mounts one game in the cross-origin sandbox. Remounts on gameId or role change, never on a
 * roster change - the roster travels over the port instead, so a player joining mid-game does
 * not tear down and rebuild the running game. */
export function SandboxFrame(props: SandboxFrameProps) {
  const { base, gameId, version, role, onConnect, onMessage, onError } = props;
  const ref = useRef<HTMLIFrameElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  // Callbacks and the bootstrap roster are read through a ref so a parent re-render never
  // re-runs the connect effect, which would open a second channel to the same frame.
  const live = useRef({ onConnect, onMessage, onError, players: props.players });
  live.current = { onConnect, onMessage, onError, players: props.players };

  useEffect(() => {
    try {
      assertDistinctOrigin(base, window.location.origin);
    } catch (err) {
      live.current.onError(err instanceof Error ? err.message : String(err));
      return;
    }
    setSrc(sandboxFrameUrl(base, { gameId, role, version }));
  }, [base, gameId, role, version]);

  useEffect(() => {
    const iframe = ref.current;
    if (!iframe || !src) return;
    const bridge = connectSandbox({
      iframe,
      role,
      players: live.current.players,
      onMessage: (msg) => live.current.onMessage(msg),
      onError: (reason) => live.current.onError(reason),
    });
    live.current.onConnect(bridge);
    return () => bridge.close();
  }, [src, role]);

  if (!src) return null;
  return (
    <iframe
      ref={ref}
      src={src}
      title="Game"
      sandbox="allow-scripts"
      allow="autoplay"
      referrerPolicy="no-referrer"
      style={FRAME_STYLE}
    />
  );
}
