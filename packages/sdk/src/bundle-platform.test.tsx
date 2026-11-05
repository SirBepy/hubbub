// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { defineGameBundle } from "./bundle.js";
import { usePlatform } from "./platform.js";

describe("defineGameBundle usePlatform bridge", () => {
  it("a host controller's rematch() crosses the port as a platform message", async () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    const bundle = defineGameBundle({
      logic: {} as never,
      Screen: () => null,
      Controller: () => {
        const p = usePlatform();
        return <button onClick={p.rematch}>again</button>;
      },
    });
    const channel = new MessageChannel();
    const seen: unknown[] = [];
    channel.port1.onmessage = (e) => seen.push(e.data);
    bundle.attach({ root, port: channel.port2, role: "controller" });

    channel.port1.postMessage({ t: "platform", isHost: true });
    channel.port1.postMessage({ t: "state", state: {}, playerId: "p1" });
    await vi.waitFor(() => expect(root.querySelector("button")).not.toBeNull());
    root.querySelector("button")!.click();
    await vi.waitFor(() => expect(seen).toContainEqual({ t: "platform", action: "rematch" }));
    channel.port1.close();
  });
});
