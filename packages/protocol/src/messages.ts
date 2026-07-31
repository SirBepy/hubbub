import { z } from "zod";

/** Canonical order of the fixed six player colors; protocol stores only the index. */
export const PLAYER_COLOR_NAMES = ["magenta", "cyan", "lime", "amber", "violet", "blue"] as const;

export const IdentitySchema = z.object({
  name: z.string().min(1).max(24),
  colorId: z.number().int().min(0).max(5),
  emoji: z.string().min(1).max(16),
});
export type Identity = z.infer<typeof IdentitySchema>;

export const PlayerSchema = IdentitySchema.extend({
  id: z.string(),
  connected: z.boolean(),
});
export type Player = z.infer<typeof PlayerSchema>;

export const GameSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  minPlayers: z.number().int(),
  maxPlayers: z.number().int().optional(),
  featured: z.boolean(),
  category: z.string().optional(),
  identityColors: z.tuple([z.number().int(), z.number().int()]).optional(),
});
export type GameSummary = z.infer<typeof GameSummarySchema>;

export const SuggestionSchema = z.object({
  gameId: z.string(),
  playerId: z.string(),
});
export type Suggestion = z.infer<typeof SuggestionSchema>;

// Client -> Server
export const ClientMessageSchema = z.discriminatedUnion("t", [
  z.object({ t: z.literal("createRoom") }),
  z.object({ t: z.literal("joinRoom"), code: z.string().length(4), ...IdentitySchema.shape, token: z.string().optional() }),
  z.object({ t: z.literal("setIdentity"), ...IdentitySchema.shape }),
  z.object({ t: z.literal("lobbyNav"), dir: z.enum(["up", "down", "left", "right"]) }),
  z.object({ t: z.literal("lobbyFocus"), index: z.number().int().min(0) }),
  z.object({ t: z.literal("lobbyConfirm") }),
  z.object({ t: z.literal("returnToLobby") }),
  z.object({ t: z.literal("transferHost"), toPlayerId: z.string() }),
  z.object({ t: z.literal("suggestGame"), gameId: z.string() }),
  z.object({ t: z.literal("rematch") }),
  z.object({ t: z.literal("action"), payload: z.unknown().optional() }),
]);
export type ClientMessage = z.infer<typeof ClientMessageSchema>;

// Server -> Client
export const ServerMessageSchema = z.discriminatedUnion("t", [
  z.object({ t: z.literal("roomCreated"), code: z.string().length(4) }),
  z.object({ t: z.literal("joined"), playerId: z.string(), token: z.string() }),
  z.object({
    t: z.literal("roomState"),
    players: z.array(PlayerSchema),
    hostId: z.string().nullable(),
    mode: z.enum(["lobby", "in-game"]),
    currentGameId: z.string().nullable(),
    cursorIndex: z.number().int(),
    games: z.array(GameSummarySchema),
    suggestions: z.array(SuggestionSchema),
  }),
  z.object({ t: z.literal("gameState"), gameId: z.string(), state: z.unknown() }),
  z.object({ t: z.literal("error"), code: z.string(), message: z.string() }),
]);
export type ServerMessage = z.infer<typeof ServerMessageSchema>;

export function parseClientMessage(raw: string): ClientMessage {
  return ClientMessageSchema.parse(JSON.parse(raw));
}
export function parseServerMessage(raw: string): ServerMessage {
  return ServerMessageSchema.parse(JSON.parse(raw));
}
