import { describe, it, expect } from "vitest";
import { parseClientMessage, parseServerMessage } from "./messages.js";

describe("protocol messages", () => {
  it("parses a valid joinRoom with identity", () => {
    const raw = { t: "joinRoom", code: "ABCD", name: "Joe", color: "#4363d8", emoji: "🦊" };
    expect(parseClientMessage(JSON.stringify(raw))).toEqual(raw);
  });

  it("rejects an unknown message type", () => {
    expect(() => parseClientMessage(JSON.stringify({ t: "nope" }))).toThrow();
  });

  it("rejects joinRoom missing identity fields", () => {
    expect(() =>
      parseClientMessage(JSON.stringify({ t: "joinRoom", code: "ABCD", name: "Joe" }))
    ).toThrow();
  });

  it("parses lobby control messages", () => {
    expect(parseClientMessage(JSON.stringify({ t: "lobbyNav", dir: "left" }))).toEqual({ t: "lobbyNav", dir: "left" });
    expect(parseClientMessage(JSON.stringify({ t: "lobbyFocus", index: 2 }))).toEqual({ t: "lobbyFocus", index: 2 });
    expect(parseClientMessage(JSON.stringify({ t: "lobbyConfirm" }))).toEqual({ t: "lobbyConfirm" });
    expect(parseClientMessage(JSON.stringify({ t: "returnToLobby" }))).toEqual({ t: "returnToLobby" });
    expect(parseClientMessage(JSON.stringify({ t: "transferHost", toPlayerId: "p2" }))).toEqual({ t: "transferHost", toPlayerId: "p2" });
    expect(parseClientMessage(JSON.stringify({ t: "setIdentity", name: "Jo", color: "#000", emoji: "🐼" }))).toEqual({ t: "setIdentity", name: "Jo", color: "#000", emoji: "🐼" });
  });

  it("rejects lobbyNav with a bad direction", () => {
    expect(() => parseClientMessage(JSON.stringify({ t: "lobbyNav", dir: "sideways" }))).toThrow();
  });

  it("parses a gameState server message with gameId", () => {
    const raw = { t: "gameState", gameId: "ttt", state: { foo: 1 } };
    expect(parseServerMessage(JSON.stringify(raw))).toEqual(raw);
  });

  it("parses a roomState server message with lobby context", () => {
    const raw = {
      t: "roomState",
      players: [{ id: "p1", name: "Joe", color: "#f58231", emoji: "🐱", connected: true }],
      hostId: "p1",
      mode: "lobby",
      currentGameId: null,
      cursorIndex: 0,
      games: [{ id: "ttt", name: "Tic-Tac-Toe", minPlayers: 2, maxPlayers: 2, featured: true }],
    };
    expect(parseServerMessage(JSON.stringify(raw))).toEqual(raw);
  });
});
