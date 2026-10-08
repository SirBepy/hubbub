// @vitest-environment jsdom
//
// The branch that ships: with `__HUBBUB_DEV_LOADER__` false, the screen frames the game from the
// sandbox origin instead of importing it. Every other test runs the direct loader, which is how a
// sandbox path that could never mount a game once passed a whole phase of green checks.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { harness, launchPendingGame } from "./app-test-harness";

// Module-level, so it is in place before App.tsx's module body reads the flag on first import.
vi.stubGlobal("__HUBBUB_DEV_LOADER__", false);

vi.mock("@hubbub/protocol/webrtc", async () => {
  const { FakeTransport, harness } = await import("./app-test-harness");
  return {
    WebRtcClientTransport: vi.fn(function WebRtcClientTransport() {
      harness.last = new FakeTransport();
      return harness.last;
    }),
  };
});

vi.mock("@hubbub/protocol", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@hubbub/protocol")>();
  return { ...actual, createRoomHttp: vi.fn().mockResolvedValue("ABCD") };
});

vi.mock("./screen-session", () => ({
  loadScreenSession: vi.fn().mockReturnValue(null),
  saveScreenSession: vi.fn(),
  clearScreenSession: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("sandbox branch", () => {
  it("frames a pending game from the sandbox origin before any game state exists", async () => {
    const { App } = await import("./App");
    render(<App />);

    await waitFor(() => expect(harness.last).toBeDefined(), { timeout: 10000 });
    launchPendingGame(harness.last!);

    // jsdom serves the shell from localhost:3000, so the hostname-derived sandbox default is
    // localhost:5176 - a distinct origin, which is what lets SandboxFrame set a src at all.
    await screen.findByText("ABCD", {}, { timeout: 10000 });
    const frame = await waitFor(
      () => {
        const el = document.querySelector("iframe");
        expect(el?.getAttribute("src")).toBe("http://localhost:5176/frame.html?game=tap-race&role=screen&v=dev");
        return el!;
      },
      { timeout: 10000 },
    );
    expect(frame.getAttribute("sandbox")).toBe("allow-scripts");
  }, 20000);
});
