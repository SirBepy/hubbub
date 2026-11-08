// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import type { GameResult } from "@hubbub/sdk";
import type { WebRtcClientTransport } from "@hubbub/protocol/webrtc";

// logic.result builds a new object on every call, exactly like the real games' logic.
vi.mock("./game", () => ({
  loadGameController: async () => ({
    logic: { result: () => ({ winnerId: "a", isDraw: false }) },
    Controller: () => null,
  }),
}));

import DirectControllerView from "./direct-controller-view";

// Stable, like the room state the app passes down: a new object per render would defeat the memo.
const STATE = {};

afterEach(cleanup);

describe("DirectControllerView", () => {
  it("reports a finished game's result without looping the parent into endless re-renders", async () => {
    let reported = 0;
    function Parent() {
      const [, setResult] = useState<GameResult | null>(null);
      return (
        <DirectControllerView
          gameId="ttt"
          state={STATE}
          playerId="a"
          players={[]}
          transport={{ send() {} } as unknown as WebRtcClientTransport}
          isHost
          onResult={(r) => {
            reported++;
            setResult(r);
          }}
        />
      );
    }
    render(<Parent />);
    await waitFor(() => expect(reported).toBeGreaterThan(0));
    await new Promise((r) => setTimeout(r, 100));
    expect(reported).toBeLessThan(5);
  });
});
