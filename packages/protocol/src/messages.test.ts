import { describe, it, expect } from "vitest";
import { parseClientMessage, parseServerMessage } from "./messages.js";

describe("protocol messages", () => {
  it("parses a valid joinRoom client message", () => {
    const msg = parseClientMessage(
      JSON.stringify({ t: "joinRoom", code: "ABCD", name: "Joe" })
    );
    expect(msg).toEqual({ t: "joinRoom", code: "ABCD", name: "Joe" });
  });

  it("rejects an unknown message type", () => {
    expect(() => parseClientMessage(JSON.stringify({ t: "nope" }))).toThrow();
  });

  it("rejects joinRoom with a missing name", () => {
    expect(() =>
      parseClientMessage(JSON.stringify({ t: "joinRoom", code: "ABCD" }))
    ).toThrow();
  });

  it("parses a roomState server message with players", () => {
    const msg = parseServerMessage(
      JSON.stringify({
        t: "roomState",
        players: [{ id: "p1", name: "Joe", connected: true }],
      })
    );
    expect(msg).toEqual({
      t: "roomState",
      players: [{ id: "p1", name: "Joe", connected: true }],
    });
  });
});
