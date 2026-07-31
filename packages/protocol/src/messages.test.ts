import { describe, it, expect } from "vitest";
import { parseClientMessage, parseServerMessage } from "./messages.js";

describe("protocol messages", () => {
  it("parses a valid joinRoom with identity", () => {
    const raw = { t: "joinRoom", code: "ABCD", name: "Joe", colorId: 3, emoji: "🦊" };
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
    expect(parseClientMessage(JSON.stringify({ t: "setIdentity", name: "Jo", colorId: 0, emoji: "🐼" }))).toEqual({ t: "setIdentity", name: "Jo", colorId: 0, emoji: "🐼" });
    expect(parseClientMessage(JSON.stringify({ t: "suggestGame", gameId: "ttt" }))).toEqual({ t: "suggestGame", gameId: "ttt" });
    expect(parseClientMessage(JSON.stringify({ t: "rematch" }))).toEqual({ t: "rematch" });
  });

  it("rejects suggestGame without a gameId", () => {
    expect(() => parseClientMessage(JSON.stringify({ t: "suggestGame" }))).toThrow();
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
      players: [{ id: "p1", name: "Joe", colorId: 4, emoji: "🐱", connected: true }],
      hostId: "p1",
      mode: "lobby",
      currentGameId: null,
      cursorIndex: 0,
      games: [{ id: "ttt", name: "Tic-Tac-Toe", minPlayers: 2, maxPlayers: 2, featured: true }],
      suggestions: [{ gameId: "ttt", playerId: "p1" }],
    };
    expect(parseServerMessage(JSON.stringify(raw))).toEqual(raw);
  });

  it("rejects a roomState missing suggestions", () => {
    expect(() =>
      parseServerMessage(JSON.stringify({
        t: "roomState", players: [], hostId: null, mode: "lobby",
        currentGameId: null, cursorIndex: 0, games: [],
      }))
    ).toThrow();
  });
});
