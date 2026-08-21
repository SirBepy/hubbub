import { describe, it, expect } from "vitest";
import { loadScreenSession, saveScreenSession, clearScreenSession } from "./screen-session.js";

function fakeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
    clear: () => map.clear(),
    key: () => null,
    get length() { return map.size; },
  };
}

describe("screen-session", () => {
  it("round-trips a saved session", () => {
    const storage = fakeStorage();
    saveScreenSession(storage, { code: "ABCD", token: "tok0" });
    expect(loadScreenSession(storage)).toEqual({ code: "ABCD", token: "tok0" });
  });

  it("returns null when nothing is stored", () => {
    expect(loadScreenSession(fakeStorage())).toBeNull();
  });

  it("returns null instead of throwing on corrupt JSON", () => {
    const storage = fakeStorage();
    storage.setItem("hubbub:screen", "{not json");
    expect(loadScreenSession(storage)).toBeNull();
  });

  it("returns null when the shape is wrong", () => {
    const storage = fakeStorage();
    storage.setItem("hubbub:screen", JSON.stringify({ code: "ABCD" }));
    expect(loadScreenSession(storage)).toBeNull();
  });

  it("clearScreenSession removes a saved session", () => {
    const storage = fakeStorage();
    saveScreenSession(storage, { code: "ABCD", token: "tok0" });
    clearScreenSession(storage);
    expect(loadScreenSession(storage)).toBeNull();
  });
});
