import { describe, expect, it, vi } from "vitest";
import { BootstrapSchema, MAX_STATE_BYTES, stateWithinCap } from "@hubbub/sdk/bridge";
import {
  assertDistinctOrigin,
  connectSandbox,
  createSandboxAuthority,
  sandboxFrameUrl,
  SandboxOriginError,
  type SandboxBridge,
} from "./shell.js";
import type { DisplayPlayer } from "@hubbub/sdk";

/** Ports deliver asynchronously, so a single macrotask tick is not a reliable barrier under a
 * loaded suite. Polls for the expected call count instead. */
async function until(check: () => boolean, timeoutMs = 2_000): Promise<void> {
  const started = Date.now();
  while (!check()) {
    if (Date.now() - started > timeoutMs) throw new Error("timed out waiting for port delivery");
    await new Promise((r) => setTimeout(r, 5));
  }
}

const PLAYERS: DisplayPlayer[] = [
  { id: "p1", name: "Ana", colorId: 0, avatarId: "fox", connected: true },
  { id: "p2", name: "Bo", colorId: 1, avatarId: "owl", connected: true },
];

function recordingBridge() {
  const sent: unknown[] = [];
  const bridge: SandboxBridge = { send: (m) => void sent.push(m), close: () => {} };
  return { bridge, sent };
}

describe("assertDistinctOrigin (S5)", () => {
  it("refuses a sandbox base that resolves to the shell's own origin", () => {
    expect(() => assertDistinctOrigin("http://localhost:5175/games/", "http://localhost:5175")).toThrow(
      SandboxOriginError,
    );
  });

  it("accepts a second port on the same host", () => {
    expect(() => assertDistinctOrigin("http://localhost:5176", "http://localhost:5175")).not.toThrow();
  });

  it("accepts a second workers.dev subdomain", () => {
    expect(() =>
      assertDistinctOrigin("https://hubbub-games.tabsxlabs.workers.dev", "https://hubbub.tabsxlabs.workers.dev"),
    ).not.toThrow();
  });

  it("refuses a base that is not a URL at all rather than mounting", () => {
    expect(() => assertDistinctOrigin("::not a url::", "http://localhost:5175")).toThrow(SandboxOriginError);
  });
});

describe("sandboxFrameUrl", () => {
  it("serves the platform's own frame document, never the bundle, as the frame src", () => {
    const url = sandboxFrameUrl("http://localhost:5176", { gameId: "sample", role: "screen", version: "abc123" });
    expect(url).toBe("http://localhost:5176/frame.html?game=sample&role=screen&v=abc123");
  });

  it("tolerates a base with a trailing slash", () => {
    const url = sandboxFrameUrl("http://localhost:5176/", { gameId: "ttt", role: "controller", version: "d" });
    expect(url).toBe("http://localhost:5176/frame.html?game=ttt&role=controller&v=d");
  });
});

describe("state size cap (S6)", () => {
  it("rejects a payload past the cap regardless of what the game declares", () => {
    expect(stateWithinCap({ blob: "x".repeat(MAX_STATE_BYTES) })).toBe(false);
  });

  it("accepts an ordinary game state", () => {
    expect(stateWithinCap({ taps: { p1: 3, p2: 9 }, winnerId: null })).toBe(true);
  });

  it("rejects state that is not serializable at all", () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(stateWithinCap(cyclic)).toBe(false);
    expect(stateWithinCap(() => {})).toBe(false);
  });

  // z.unknown() cannot express "required but any shape", so a state-less message parses.
  // The byte cap is what actually rejects it, which is the point of running before the schema.
  it("drops a state message that carries no state", () => {
    const { bridge } = recordingBridge();
    const onState = vi.fn();
    const onError = vi.fn();
    const authority = createSandboxAuthority(bridge, { onState, onResult: vi.fn(), onError });
    authority.handle({ t: "state", state: undefined });
    expect(onState).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledOnce();
  });

  it("drops an oversized state instead of forwarding it", () => {
    const { bridge } = recordingBridge();
    const onState = vi.fn();
    const onError = vi.fn();
    const authority = createSandboxAuthority(bridge, { onState, onResult: vi.fn(), onError });
    authority.launch(PLAYERS, undefined, 0);
    authority.handle({ t: "state", state: { blob: "x".repeat(MAX_STATE_BYTES) } });
    expect(onState).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledOnce();
  });
});

describe("deadline scheduling (S7, weaponised LB-1)", () => {
  it("floors a past deadline instead of collapsing to a 0ms self-rescheduling timer", () => {
    vi.useFakeTimers();
    const { bridge, sent } = recordingBridge();
    const authority = createSandboxAuthority(bridge, { onState: vi.fn(), onResult: vi.fn(), onError: vi.fn() });
    authority.launch(PLAYERS, undefined, Date.now());
    sent.length = 0;

    authority.handle({ t: "deadline", at: Date.now() - 1_000_000 });
    vi.advanceTimersByTime(15);
    expect(sent).toHaveLength(0); // still inside the 16ms floor
    vi.advanceTimersByTime(1);
    expect(sent).toEqual([{ t: "timeout", now: expect.any(Number) }]);

    // One timeout per deadline: the shell never re-arms on its own, so a game that keeps
    // returning a stale deadline cannot drive an unbounded loop on the host's main thread.
    vi.advanceTimersByTime(10_000);
    expect(sent).toHaveLength(1);
    authority.reset();
    vi.useRealTimers();
  });

  it("ignores a non-finite deadline", () => {
    vi.useFakeTimers();
    const { bridge, sent } = recordingBridge();
    const authority = createSandboxAuthority(bridge, { onState: vi.fn(), onResult: vi.fn(), onError: vi.fn() });
    authority.handle({ t: "deadline", at: Number.POSITIVE_INFINITY });
    vi.advanceTimersByTime(60_000);
    expect(sent).toHaveLength(0);
    vi.useRealTimers();
  });
});

describe("result validation (2.5)", () => {
  it("drops a result naming a player the room does not have", () => {
    const { bridge } = recordingBridge();
    const onResult = vi.fn();
    const authority = createSandboxAuthority(bridge, { onState: vi.fn(), onResult, onError: vi.fn() });
    authority.launch(PLAYERS, undefined, 0);

    authority.handle({ t: "result", result: { winnerId: "session expired, rescan", isDraw: false } });
    expect(onResult).not.toHaveBeenCalled();

    authority.handle({ t: "result", result: { winnerId: "p1", isDraw: false } });
    expect(onResult).toHaveBeenCalledWith({ winnerId: "p1", isDraw: false });
  });

  it("drops standings naming an unknown player", () => {
    const { bridge } = recordingBridge();
    const onResult = vi.fn();
    const authority = createSandboxAuthority(bridge, { onState: vi.fn(), onResult, onError: vi.fn() });
    authority.launch(PLAYERS, undefined, 0);
    authority.handle({
      t: "result",
      result: { winnerId: null, isDraw: false, standings: [{ playerId: "ghost", position: 1 }] },
    });
    expect(onResult).not.toHaveBeenCalled();
  });

  it("re-reads the roster after a roster change", () => {
    const { bridge } = recordingBridge();
    const onResult = vi.fn();
    const authority = createSandboxAuthority(bridge, { onState: vi.fn(), onResult, onError: vi.fn() });
    authority.launch(PLAYERS, undefined, 0);
    authority.playersChanged([PLAYERS[1]!]);
    authority.handle({ t: "result", result: { winnerId: "p1", isDraw: false } });
    expect(onResult).not.toHaveBeenCalled();
  });
});

describe("bootstrap payload (S12)", () => {
  it("carries id and name only, and strips anything wider", () => {
    const parsed = BootstrapSchema.safeParse({
      t: "hubbub-init",
      role: "screen",
      players: [{ id: "p1", name: "Ana", token: "<placeholder>", colorId: 0 }],
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts a PlayerInfo roster", () => {
    const parsed = BootstrapSchema.safeParse({
      t: "hubbub-init",
      role: "screen",
      players: [{ id: "p1", name: "Ana" }],
    });
    expect(parsed.success).toBe(true);
  });
});

describe("connectSandbox", () => {
  function fakeIframe() {
    let onLoad: (() => void) | null = null;
    const posted: { data: unknown; target: string; ports: readonly MessagePort[] }[] = [];
    const iframe = {
      addEventListener: (_type: string, fn: () => void) => {
        onLoad = fn;
      },
      contentWindow: {
        postMessage: (data: unknown, target: string, ports: MessagePort[]) => posted.push({ data, target, ports }),
      },
    } as unknown as HTMLIFrameElement;
    return { iframe, posted, fire: () => onLoad?.() };
  }

  it("hands the frame exactly one port, with a PlayerInfo-only payload", () => {
    const { iframe, posted, fire } = fakeIframe();
    const bridge = connectSandbox({
      iframe,
      role: "screen",
      players: [{ id: "p1", name: "Ana" }],
      onMessage: vi.fn(),
      onError: vi.fn(),
    });
    fire();
    expect(posted).toHaveLength(1);
    expect(posted[0]!.target).toBe("*");
    expect(posted[0]!.ports).toHaveLength(1);
    expect(posted[0]!.data).toEqual({ t: "hubbub-init", role: "screen", players: [{ id: "p1", name: "Ana" }] });
    bridge.close();
  });

  it("reports an error rather than falling back when the frame never acks", () => {
    vi.useFakeTimers();
    const { iframe, fire } = fakeIframe();
    const onError = vi.fn();
    const bridge = connectSandbox({ iframe, role: "screen", players: [], onMessage: vi.fn(), onError, readyTimeoutMs: 100 });
    fire();
    vi.advanceTimersByTime(101);
    expect(onError).toHaveBeenCalledOnce();
    bridge.close();
    vi.useRealTimers();
  });

  it("rejects a malformed inbound message instead of forwarding it", async () => {
    const { iframe, posted, fire } = fakeIframe();
    const onMessage = vi.fn();
    const onError = vi.fn();
    const bridge = connectSandbox({ iframe, role: "screen", players: [], onMessage, onError });
    fire();
    // The frame's end of the same channel: whatever a real bundle posts arrives here.
    const framePort = posted[0]!.ports[0]!;

    framePort.postMessage({ t: "gimme-token" });
    framePort.postMessage("not an object at all");
    framePort.postMessage({ t: "state", state: { ok: true } });
    await until(() => onMessage.mock.calls.length >= 1 && onError.mock.calls.length >= 2);

    expect(onError).toHaveBeenCalledTimes(2);
    expect(onMessage).toHaveBeenCalledExactlyOnceWith({ t: "state", state: { ok: true } });
    bridge.close();
  });

  it("stops delivering once closed", async () => {
    const { iframe, posted, fire } = fakeIframe();
    const onMessage = vi.fn();
    const bridge = connectSandbox({ iframe, role: "screen", players: [], onMessage, onError: vi.fn() });
    fire();
    const framePort = posted[0]!.ports[0]!;
    bridge.close();
    framePort.postMessage({ t: "ready" });
    // Nothing to poll for here - the assertion is that nothing arrives - so a fixed settle is
    // the honest shape; it only ever produces a false PASS, never a false failure.
    await new Promise((r) => setTimeout(r, 50));
    expect(onMessage).not.toHaveBeenCalled();
  });
});
