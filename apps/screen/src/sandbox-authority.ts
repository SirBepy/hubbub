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
  let gameId: string | null = null;
  let pending: { players: DisplayPlayer[]; setupData: unknown; now: number } | null = null;

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
      if (inner) inner.launch(players, setupData, now);
      else pending = { players, setupData, now };
    },
    attach(bridge) {
      if (!gameId) return;
      inner = createSandboxAuthority(bridge, callbacksFor(gameId));
      if (pending) {
        inner.launch(pending.players, pending.setupData, pending.now);
        pending = null;
      }
    },
    handle(msg) {
      inner?.handle(msg);
    },
    action(playerId, payload, now) {
      inner?.action(playerId, payload, now);
    },
    playersChanged(players) {
      if (inner) inner.playersChanged(players);
      else if (pending) pending.players = players;
    },
    currentGameId: () => gameId,
    reset() {
      inner?.reset();
      inner = null;
      gameId = null;
      pending = null;
    },
  };
}
