import { describe, expect, it } from "vitest";
import { parseJoinCode } from "./qr-code";

describe("parseJoinCode", () => {
  it("reads the room from the URL the big screen encodes", () => {
    expect(parseJoinCode("https://hubbub.sirbepy.dev/?room=K7QX")).toBe("K7QX");
    expect(parseJoinCode("http://192.168.1.20:5174/?room=ab3d")).toBe("AB3D");
  });

  it("accepts a bare code, any case, with stray whitespace", () => {
    expect(parseJoinCode("K7QX")).toBe("K7QX");
    expect(parseJoinCode("  k7qx\n")).toBe("K7QX");
  });

  it("rejects text that is not a join payload", () => {
    expect(parseJoinCode("hello world")).toBeNull();
    expect(parseJoinCode("https://example.com/")).toBeNull();
    expect(parseJoinCode("https://example.com/?room=")).toBeNull();
    expect(parseJoinCode("")).toBeNull();
  });

  it("rejects a code of the wrong length, bare or in a URL", () => {
    expect(parseJoinCode("K7Q")).toBeNull();
    expect(parseJoinCode("K7QXZ")).toBeNull();
    expect(parseJoinCode("https://hubbub.sirbepy.dev/?room=K7QXZ")).toBeNull();
  });
});
