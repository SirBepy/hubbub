import { describe, it, expect } from "vitest";
import { getLanIp } from "./lan.js";

describe("getLanIp", () => {
  it("returns the first non-internal IPv4 address", () => {
    const ip = getLanIp({
      lo: [{ family: "IPv4", internal: true, address: "127.0.0.1" } as any],
      eth0: [{ family: "IPv4", internal: false, address: "192.168.1.42" } as any],
    });
    expect(ip).toBe("192.168.1.42");
  });

  it("skips IPv6 and returns the IPv4 address", () => {
    const ip = getLanIp({
      eth0: [
        { family: "IPv6", internal: false, address: "fe80::1" } as any,
        { family: "IPv4", internal: false, address: "10.0.0.5" } as any,
      ],
    });
    expect(ip).toBe("10.0.0.5");
  });

  it("falls back to 127.0.0.1 when no external IPv4 exists", () => {
    const ip = getLanIp({
      lo: [{ family: "IPv4", internal: true, address: "127.0.0.1" } as any],
    });
    expect(ip).toBe("127.0.0.1");
  });
});
