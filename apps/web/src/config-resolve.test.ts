import { describe, it, expect } from "vitest";
import { resolveWebConfig } from "./config-resolve.js";

describe("resolveWebConfig", () => {
  it("dev mode with no env var uses the hostname-derived relay on 7787", () => {
    const cfg = resolveWebConfig(
      {},
      { hostname: "192.168.1.42", origin: "http://192.168.1.42:5175", protocol: "http:" },
      { dev: true },
    );
    expect(cfg.controllerUrl).toBe("http://192.168.1.42:5175");
    expect(cfg.serverUrl).toBe("ws://192.168.1.42:7787");
  });

  it("prod mode with no env var resolves to the page's own origin (http -> ws)", () => {
    const cfg = resolveWebConfig(
      {},
      { hostname: "192.168.1.42", origin: "http://192.168.1.42:8788", protocol: "http:" },
      { dev: false },
    );
    expect(cfg.serverUrl).toBe("ws://192.168.1.42:8788");
  });

  it("prod mode with no env var maps https origin to wss", () => {
    const cfg = resolveWebConfig(
      {},
      { hostname: "example.com", origin: "https://example.com", protocol: "https:" },
      { dev: false },
    );
    expect(cfg.serverUrl).toBe("wss://example.com");
  });

  it("lets VITE_SERVER_URL override the default in dev mode", () => {
    const cfg = resolveWebConfig(
      { VITE_SERVER_URL: "ws://cloud:9000" },
      { hostname: "example.com", origin: "https://example.com", protocol: "https:" },
      { dev: true },
    );
    expect(cfg.serverUrl).toBe("ws://cloud:9000");
    expect(cfg.controllerUrl).toBe("https://example.com");
  });

  it("lets VITE_SERVER_URL override the default in prod mode", () => {
    const cfg = resolveWebConfig(
      { VITE_SERVER_URL: "ws://cloud:9000" },
      { hostname: "example.com", origin: "https://example.com", protocol: "https:" },
      { dev: false },
    );
    expect(cfg.serverUrl).toBe("ws://cloud:9000");
    expect(cfg.controllerUrl).toBe("https://example.com");
  });
});
