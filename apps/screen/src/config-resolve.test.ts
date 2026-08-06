import { describe, it, expect } from "vitest";
import { DEFAULT_STUN_URL } from "@hubbub/protocol";
import { resolveConfig } from "./config-resolve.js";

describe("resolveConfig", () => {
  it("prefers the injected host config (Electron preload)", () => {
    const cfg = resolveConfig(
      { serverUrl: "ws://localhost:7787", controllerUrl: "http://192.168.1.42:7780" },
      {},
      "127.0.0.1",
    );
    expect(cfg.serverUrl).toBe("ws://localhost:7787");
    expect(cfg.controllerUrl).toBe("http://192.168.1.42:7780");
  });

  it("falls back to Vite env vars when nothing is injected", () => {
    const cfg = resolveConfig(
      undefined,
      { VITE_SERVER_URL: "ws://cloud:9000", VITE_CONTROLLER_URL: "https://app" },
      "example.com",
    );
    expect(cfg.serverUrl).toBe("ws://cloud:9000");
    expect(cfg.controllerUrl).toBe("https://app");
  });

  it("falls back to hostname-derived defaults last", () => {
    const cfg = resolveConfig(undefined, {}, "myhost");
    expect(cfg.serverUrl).toBe("ws://myhost:7787");
    expect(cfg.controllerUrl).toBe("http://myhost:5174");
    expect(cfg.stunUrl).toBe(DEFAULT_STUN_URL);
  });

  it("uses an injected value even if a partial injection omits the other", () => {
    const cfg = resolveConfig({ controllerUrl: "http://1.2.3.4:7780" }, {}, "myhost");
    expect(cfg.serverUrl).toBe("ws://myhost:7787");
    expect(cfg.controllerUrl).toBe("http://1.2.3.4:7780");
  });
});
