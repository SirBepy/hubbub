import { describe, it, expect } from "vitest";
import { parseClientMessage, parseServerMessage, GameSummarySchema } from "./messages.js";

describe("protocol messages", () => {
  it("parses a valid joinRoom with identity (no code - that comes from the connection URL)", () => {
    const raw = { t: "joinRoom", name: "Joe", colorId: 3, emoji: "🦊" };
    expect(parseClientMessage(JSON.stringify(raw))).toEqual(raw);
  });

  it("parses attachScreen with and without a reattach token", () => {
    expect(parseClientMessage(JSON.stringify({ t: "attachScreen" }))).toEqual({ t: "attachScreen" });
    const withToken = { t: "attachScreen", token: "tok0" };
    expect(parseClientMessage(JSON.stringify(withToken))).toEqual(withToken);
  });

  it("parses roomCreated with and without a screenToken", () => {
    expect(parseServerMessage(JSON.stringify({ t: "roomCreated", code: "ABCD" }))).toEqual({ t: "roomCreated", code: "ABCD" });
    const withToken = { t: "roomCreated", code: "ABCD", screenToken: "tok0" };
    expect(parseServerMessage(JSON.stringify(withToken))).toEqual(withToken);
  });

  it("rejects an unknown message type", () => {
    expect(() => parseClientMessage(JSON.stringify({ t: "nope" }))).toThrow();
  });

  it("rejects joinRoom missing identity fields", () => {
    expect(() =>
      parseClientMessage(JSON.stringify({ t: "joinRoom", name: "Joe" }))
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

  it("parses lobbyConfirm carrying per-game start options", () => {
    const raw = { t: "lobbyConfirm", options: { roundCount: 5, source: { kind: "category", categoryId: "80s" } } };
    expect(parseClientMessage(JSON.stringify(raw))).toEqual(raw);
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

  it("parses a gameLaunch server message (screen authority hand-off)", () => {
    const raw = { t: "gameLaunch", gameId: "ttt", players: [{ id: "p1", name: "Joe" }], setupData: { a: 1 }, now: 1000 };
    expect(parseServerMessage(JSON.stringify(raw))).toEqual(raw);
  });

  it("parses a gameAction server message relaying a controller's action to the screen", () => {
    const raw = { t: "gameAction", playerId: "p1", payload: { cell: 0 }, now: 1000 };
    expect(parseServerMessage(JSON.stringify(raw))).toEqual(raw);
  });

  it("parses a gameStatePush client message from the screen", () => {
    const raw = { t: "gameStatePush", gameId: "ttt", state: { board: [] } };
    expect(parseClientMessage(JSON.stringify(raw))).toEqual(raw);
  });

  it("parses a roomState server message with lobby context", () => {
    const raw = {
      t: "roomState",
      players: [{ id: "p1", name: "Joe", colorId: 4, emoji: "🐱", connected: true }],
      hostId: "p1",
      mode: "lobby",
      currentGameId: null,
      cursorIndex: 0,
      games: [{ id: "ttt", name: "Tic-Tac-Toe", minPlayers: 2, maxPlayers: 2 }],
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

  it("accepts a GameSummary with a valid aspectRatio", () => {
    const raw = { id: "racer", name: "Racer", minPlayers: 1, maxPlayers: 4, aspectRatio: 16 / 9 };
    expect(GameSummarySchema.parse(raw)).toEqual(raw);
  });

  it("accepts a GameSummary omitting aspectRatio", () => {
    const raw = { id: "ttt", name: "Tic-Tac-Toe", minPlayers: 2, maxPlayers: 2 };
    expect(GameSummarySchema.parse(raw).aspectRatio).toBeUndefined();
  });

  it("rejects a GameSummary with a malformed aspectRatio", () => {
    const base = { id: "racer", name: "Racer", minPlayers: 1, maxPlayers: 4 };
    expect(() => GameSummarySchema.parse({ ...base, aspectRatio: 0 })).toThrow();
    expect(() => GameSummarySchema.parse({ ...base, aspectRatio: -1.5 })).toThrow();
    expect(() => GameSummarySchema.parse({ ...base, aspectRatio: "16:9" })).toThrow();
    expect(() => GameSummarySchema.parse({ ...base, aspectRatio: 100 })).toThrow();
  });
});
