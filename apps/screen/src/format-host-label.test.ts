import { describe, it, expect } from "vitest";
import { formatHostLabel } from "./format-host-label.js";

describe("formatHostLabel", () => {
  it("strips the scheme", () => {
    expect(formatHostLabel("http://example.com")).toBe("EXAMPLE.COM");
    expect(formatHostLabel("https://hubbub.workers.dev")).toBe("HUBBUB.WORKERS.DEV");
  });

  it("strips a leading www.", () => {
    expect(formatHostLabel("https://www.hubbub.tv")).toBe("HUBBUB.TV");
  });

  it("keeps a port when one is present", () => {
    expect(formatHostLabel("http://192.168.1.5:5175")).toBe("192.168.1.5:5175");
  });

  it("uppercases for display", () => {
    expect(formatHostLabel("http://myhost:5174")).toBe("MYHOST:5174");
  });
});
