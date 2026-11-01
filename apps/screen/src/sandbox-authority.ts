import { createSandboxAuthority, type SandboxAuthority, type SandboxBridge } from "@hubbub/sandbox";
import type { FrameToShell } from "@hubbub/sdk/bridge";
import type { DisplayPlayer } from "@hubbub/sdk";
import type { AuthorityCallbacks, ScreenAuthority } from "./authority";

export interface SandboxScreenAuthority extends ScreenAuthority {
  /** Called by the frame's onConnect. The launch that arrived first is replayed here. */
  attach(bridge: SandboxBridge): void;
  handle(msg: FrameToShell): void;
  currentGameId(): string | null;
}

/** Drives a game living inside the sandbox frame. The reducer is over there, so this holds only
 * what must stay outside untrusted code, and it buffers: `gameLaunch` off the wire and the
 * frame's own `onConnect` race each other, and either can win. */
export function createSandboxScreenAuthority(cb: AuthorityCallbacks): SandboxScreenAuthority {
  let inner: SandboxAuthority | null = null;
  // Held even before a gameId exists: a warm frame's onConnect routinely lands before gameLaunch
  // does, and dropping the bridge then left the launch pending forever (TV stuck on "Loading").
  let bridge: SandboxBridge | null = null;
  let gameId: string | null = null;
  // The latest launch, kept after delivery: a rematch relaunches while the end-of-round screen
  // has unmounted the old frame, so that launch goes into a closed bridge and the NEW frame's
  // attach has to replay it. A fresh frame has no game running, so a replay never doubles one.
  let last: { players: DisplayPlayer[]; setupData: unknown; now: number } | null = null;

  function callbacksFor(id: string) {
    return {
      onState: (state: unknown) => cb.onState(id, state),
      onResult: cb.onResult,
      onError: cb.onFailure,
    };
  }

  return {
    launch(id, players, setupData, now) {
      gameId = id;
      last = { players, setupData, now };
      if (!inner && bridge) inner = createSandboxAuthority(bridge, callbacksFor(id));
      inner?.launch(players, setupData, now);
    },
    attach(next) {
      bridge = next;
      if (!gameId) return;
      inner = createSandboxAuthority(next, callbacksFor(gameId));
      if (last) inner.launch(last.players, last.setupData, last.now);
    },
    handle(msg) {
      inner?.handle(msg);
    },
    action(playerId, payload, now) {
      inner?.action(playerId, payload, now);
    },
    playersChanged(players) {
      if (last) last.players = players;
      inner?.playersChanged(players);
    },
    currentGameId: () => gameId,
    reset() {
      inner?.reset();
      inner = null;
      // reset is the return to the lobby, which unmounts the frame and closes this bridge.
      bridge = null;
      gameId = null;
      last = null;
    },
  };
}
