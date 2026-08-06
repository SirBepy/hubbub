import { describe, it, expect } from "vitest";
import { resolveWebConfig } from "./config-resolve.js";

describe("resolveWebConfig", () => {
  it("uses the current origin as the controller URL", () => {
    const cfg = resolveWebConfig({}, { hostname: "192.168.1.42", origin: "http://192.168.1.42:5175" });
    expect(cfg.controllerUrl).toBe("http://192.168.1.42:5175");
    expect(cfg.serverUrl).toBe("ws://192.168.1.42:7787");
  });

  it("lets VITE_SERVER_URL override the hostname default", () => {
    const cfg = resolveWebConfig(
      { VITE_SERVER_URL: "ws://cloud:9000" },
      { hostname: "example.com", origin: "https://example.com" },
    );
    expect(cfg.serverUrl).toBe("ws://cloud:9000");
    expect(cfg.controllerUrl).toBe("https://example.com");
  });
});
