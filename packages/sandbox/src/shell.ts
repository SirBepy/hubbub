import { floorDelay, sfx } from "@hubbub/sdk";
import type { DisplayPlayer, GameResult } from "@hubbub/sdk";
import {
  BOOTSTRAP_TYPE,
  FrameToShellSchema,
  stateWithinCap,
  type FrameToShell,
  type SandboxRole,
  type ShellToFrame,
} from "@hubbub/sdk/bridge";

/** Thrown at mount time, never swallowed into a same-page fallback: there is no
 * "try sandboxed, catch, run in page" branch anywhere and one must never be added (2.6). */
export class SandboxOriginError extends Error {}

/** S5. A reverse-proxy typo that collapses both origins onto one vhost is invisible by
 * construction - a working demo looks exactly like a broken one - so the shell refuses to mount
 * rather than degrading silently. Safe to refuse because the shipped default (a second port on
 * LAN, a second Worker in cloud) already satisfies it. */
export function assertDistinctOrigin(sandboxBase: string, shellOrigin: string): void {
  let resolved: string;
  try {
    resolved = new URL(sandboxBase, shellOrigin).origin;
  } catch {
    throw new SandboxOriginError(`Sandbox origin "${sandboxBase}" is not a valid URL.`);
  }
  if (resolved === shellOrigin) {
    throw new SandboxOriginError(
      `Sandbox origin must differ from the shell's own origin (both are ${shellOrigin}). ` +
        `Set VITE_SANDBOX_URL to a second port or host.`,
    );
  }
}

/** `?v=` is the content hash: it names which approved bytes to serve and busts any cache when a
 * new build is approved. The frame document itself is always platform-authored. */
export function sandboxFrameUrl(
  sandboxBase: string,
  opts: { gameId: string; role: SandboxRole; version: string },
): string {
  const url = new URL("frame.html", sandboxBase.endsWith("/") ? sandboxBase : `${sandboxBase}/`);
  url.searchParams.set("game", opts.gameId);
  url.searchParams.set("role", opts.role);
  url.searchParams.set("v", opts.version);
  return url.toString();
}

export interface SandboxBridge {
  send(msg: ShellToFrame): void;
  close(): void;
}

export interface BridgeOptions {
  iframe: HTMLIFrameElement;
  role: SandboxRole;
  /** Bootstrap roster. Deliberately `{id,name}` only - this payload crosses a `"*"` postMessage. */
  players: { id: string; name: string }[];
  onMessage(msg: FrameToShell): void;
  /** Fired on a bootstrap timeout or an unparseable inbound message. Fail closed: the caller
   * shows an error state and never imports the game into the shell instead. */
  onError(reason: string): void;
  readyTimeoutMs?: number;
}

const DEFAULT_READY_TIMEOUT_MS = 10_000;

/** Establishes the MessageChannel capability described in the 2026-08-08 record, section 2.4.
 * An `event.origin` check is deliberately absent: a frame without `allow-same-origin` has an
 * opaque origin, so `event.origin` is the string "null" that every opaque origin shares. The port
 * is the identity instead - no other window holds it, so no other window can inject. */
export function connectSandbox(opts: BridgeOptions): SandboxBridge {
  const { iframe, role, players, onMessage, onError } = opts;
  const channel = new MessageChannel();
  let closed = false;
  let ready = false;
  let unsubscribeSfx: (() => void) | null = null;

  const readyTimer = setTimeout(() => {
    if (!ready && !closed) onError("The game did not respond in time.");
  }, opts.readyTimeoutMs ?? DEFAULT_READY_TIMEOUT_MS);

  // The TV is the only speaker: mute state rides into the frame over this same channel so a
  // controller-role frame (which never plays) and a screen-role frame both track it, without a
  // second postMessage("*", ...) call site for S4's structural test to worry about.
  function sendMuted() {
    if (!closed) channel.port1.postMessage({ t: "audio", muted: sfx.muted });
  }

  channel.port1.onmessage = (event: MessageEvent) => {
    if (closed) return;
    const parsed = FrameToShellSchema.safeParse(event.data);
    if (!parsed.success) {
      onError("The game sent a message the platform could not read.");
      return;
    }
    if (parsed.data.t === "ready") {
      ready = true;
      clearTimeout(readyTimer);
      sendMuted();
      unsubscribeSfx = sfx.subscribe(sendMuted);
    }
    onMessage(parsed.data);
  };
  channel.port1.start();

  iframe.addEventListener(
    "load",
    () => {
      if (closed) return;
      // The ONLY postMessage with a "*" target in this codebase, enforced by S4's grep. It is
      // safe because its payload is PlayerInfo and because "null" is not a parseable
      // targetOrigin, so an opaque frame cannot be addressed any other way.
      iframe.contentWindow?.postMessage({ t: BOOTSTRAP_TYPE, role, players }, "*", [channel.port2]);
    },
    { once: true },
  );

  return {
    send(msg) {
      if (!closed) channel.port1.postMessage(msg);
    },
    close() {
      closed = true;
      clearTimeout(readyTimer);
      channel.port1.onmessage = null;
      channel.port1.close();
      unsubscribeSfx?.();
      unsubscribeSfx = null;
    },
  };
}

export interface SandboxAuthorityCallbacks {
  onState(state: unknown): void;
  onResult(result: GameResult | null): void;
  onError(reason: string): void;
}

export interface SandboxAuthority {
  /** Starts the game inside an already-connected frame. */
  launch(players: DisplayPlayer[], setupData: unknown, now: number): void;
  action(playerId: string, action: unknown, now: number): void;
  playersChanged(players: DisplayPlayer[]): void;
  /** Routes one validated frame message. Callers hand every `onMessage` payload straight here. */
  handle(msg: FrameToShell): void;
  reset(): void;
}

/** Screen-role driver. The reducer now lives in the frame, so this holds only what must stay
 * outside untrusted code: the timer, the state size cap, and the result echo. Mirrors
 * `createGameAuthority`'s surface so the screen app's call sites do not change shape. */
export function createSandboxAuthority(bridge: SandboxBridge, cb: SandboxAuthorityCallbacks): SandboxAuthority {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let roster = new Set<string>();

  function clearTimer() {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  // Same floor as the in-process authority: `at` now arrives from an untrusted bundle, and
  // Number.isFinite does not stop a past timestamp from collapsing to a 0ms self-rescheduling
  // timeout on the screen's own main thread (LB-1's weaponised form).
  function schedule(at: number | null) {
    clearTimer();
    if (at === null) return;
    if (!Number.isFinite(at)) return;
    timer = setTimeout(() => {
      timer = null;
      bridge.send({ t: "timeout", now: Date.now() });
    }, floorDelay(at, Date.now()));
  }

  // A result naming an unknown player is dropped rather than rendered: the shell's own
  // end-of-round chrome looks up that id, so an arbitrary string is a way for a bundle to put
  // text on the host's TV through platform UI (2.5).
  function resultIsKnown(result: GameResult | null): boolean {
    if (result === null) return true;
    if (result.winnerId !== null && !roster.has(result.winnerId)) return false;
    return (result.standings ?? []).every((s) => roster.has(s.playerId));
  }

  return {
    launch(players, setupData, now) {
      clearTimer();
      roster = new Set(players.map((p) => p.id));
      bridge.send({ t: "launch", players, setupData, now });
    },
    action(playerId, action, now) {
      bridge.send({ t: "action", playerId, action, now });
    },
    playersChanged(players) {
      roster = new Set(players.map((p) => p.id));
      bridge.send({ t: "playersChanged", players });
    },
    handle(msg) {
      if (msg.t === "state") {
        if (!stateWithinCap(msg.state)) {
          cb.onError("The game's state grew past the platform limit.");
          return;
        }
        cb.onState(msg.state);
      } else if (msg.t === "deadline") {
        schedule(msg.at);
      } else if (msg.t === "result") {
        if (resultIsKnown(msg.result)) cb.onResult(msg.result);
      } else if (msg.t === "error") {
        cb.onError(msg.message);
      }
    },
    reset() {
      clearTimer();
    },
  };
}
