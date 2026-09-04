import { z } from "zod";
import { ROOM_CODE_LENGTH } from "./constants.js";

/** Canonical order of the fixed six player colors; protocol stores only the index. */
export const PLAYER_COLOR_NAMES = ["magenta", "cyan", "lime", "amber", "violet", "blue"] as const;

export const IdentitySchema = z.object({
  name: z.string().min(1).max(24),
  colorId: z.number().int().min(0).max(5),
  avatarId: z.string().min(1).max(16),
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
  category: z.string().optional(),
  description: z.string().optional(),
  identityColors: z.tuple([z.number().int(), z.number().int()]).optional(),
  // width/height. Bounded to reject garbage (0, negative, NaN, Infinity) at the boundary;
  // 0.2-5 comfortably spans portrait phone-ish to ultra-wide.
  aspectRatio: z.number().positive().finite().min(0.2).max(5).optional(),
});
export type GameSummary = z.infer<typeof GameSummarySchema>;

export const SuggestionSchema = z.object({
  gameId: z.string(),
  playerId: z.string(),
});
export type Suggestion = z.infer<typeof SuggestionSchema>;

// Draft state for the "configuring" room mode - server-owned, initialized from the game's
// SettingsSchema defaults (packages/sdk). Values are always strings; the game's own setup()
// coerces them (see hubbub-game-music-guesser's setup.ts).
export const RoomConfigSchema = z.object({
  gameId: z.string(),
  cursorIndex: z.number().int(),
  values: z.record(z.string()),
});
export type RoomConfig = z.infer<typeof RoomConfigSchema>;

// What the host's physical controller can do right now, published BY that phone and displayed by
// the TV. The phone owns the binding, so the TV never needs its own copy of the action list and a
// game's own actions ride the same channel. Six entries covers the face buttons plus shoulders.
export const InputLegendEntrySchema = z.object({
  glyph: z.string().min(1).max(4),
  label: z.string().min(1).max(24),
});
export type InputLegendEntry = z.infer<typeof InputLegendEntrySchema>;
export const InputLegendSchema = z.array(InputLegendEntrySchema).max(6);

// Client -> Server
export const ClientMessageSchema = z.discriminatedUnion("t", [
  // The room code comes from the connection URL (/room/:code), not the message - a Durable
  // Object is addressed by name at connect time, so the code must be known before any message.
  // token: the screenToken from a prior roomCreated, for a reload to reattach as the same
  // screen rather than a stranger with the room code taking it over. Absent on a first attach.
  z.object({ t: z.literal("attachScreen"), token: z.string().optional() }),
  z.object({ t: z.literal("joinRoom"), ...IdentitySchema.shape, token: z.string().optional() }),
  z.object({ t: z.literal("setIdentity"), ...IdentitySchema.shape }),
  z.object({ t: z.literal("lobbyNav"), dir: z.enum(["up", "down", "left", "right"]) }),
  z.object({ t: z.literal("lobbyFocus"), index: z.number().int().min(0) }),
  // options: raw per-game start config (e.g. Music Guesser's song pool/round settings), validated
  // by the game's own setup() - the protocol only needs to carry it, never interpret it.
  z.object({ t: z.literal("lobbyConfirm"), options: z.unknown().optional() }),
  z.object({ t: z.literal("returnToLobby") }),
  z.object({ t: z.literal("transferHost"), toPlayerId: z.string() }),
  z.object({ t: z.literal("suggestGame"), gameId: z.string() }),
  z.object({ t: z.literal("rematch") }),
  z.object({ t: z.literal("inputLegend"), entries: InputLegendSchema }),
  z.object({ t: z.literal("action"), payload: z.unknown().optional() }),
  // Screen -> Server: the screen-authoritative reducer's resulting state, after gameLaunch or
  // gameAction. Server checks the sender is that room's screen socket before rebroadcasting.
  z.object({ t: z.literal("gameStatePush"), gameId: z.string(), state: z.unknown() }),
  // Pre-game config phase (host-only, server-enforced) - the TV renders the panel, the phone is
  // the remote. Schema-less games never see these; their lobbyConfirm path is untouched above.
  z.object({ t: z.literal("configStart") }),
  z.object({ t: z.literal("configCursor"), dir: z.enum(["up", "down"]) }),
  z.object({ t: z.literal("configAdjust"), field: z.string(), dir: z.enum(["left", "right"]) }),
  z.object({ t: z.literal("configSet"), field: z.string(), value: z.string() }),
  z.object({ t: z.literal("configConfirm") }),
  z.object({ t: z.literal("configCancel") }),
  // WebRTC signalling (Phase E): opaque offer/answer/ICE payload between a controller and the
  // screen. The relay only forwards this by connId - it never parses `data`. A controller omits
  // toPlayerId (there is only one screen); the screen must supply it to reach a specific peer.
  z.object({ t: z.literal("rtcSignal"), toPlayerId: z.string().optional(), data: z.unknown() }),
]);
export type ClientMessage = z.infer<typeof ClientMessageSchema>;

// Server -> Client
export const ServerMessageSchema = z.discriminatedUnion("t", [
  // screenToken: persist alongside code to reattach on reload; optional only so older mock
  // servers in tests still validate without it.
  z.object({ t: z.literal("roomCreated"), code: z.string().length(ROOM_CODE_LENGTH), screenToken: z.string().optional() }),
  z.object({ t: z.literal("joined"), playerId: z.string(), token: z.string() }),
  z.object({
    t: z.literal("roomState"),
    players: z.array(PlayerSchema),
    hostId: z.string().nullable(),
    mode: z.enum(["lobby", "configuring", "in-game"]),
    currentGameId: z.string().nullable(),
    cursorIndex: z.number().int(),
    games: z.array(GameSummarySchema),
    suggestions: z.array(SuggestionSchema),
    config: RoomConfigSchema.nullable().optional(),
    inputLegend: InputLegendSchema.optional(),
  }),
  z.object({ t: z.literal("gameState"), gameId: z.string(), state: z.unknown() }),
  // Server -> screen only: setup() already ran server-side; the screen calls init() itself
  // with this setupData (screen-authority, Phase B - see the design spec's "Authority" section).
  z.object({
    t: z.literal("gameLaunch"),
    gameId: z.string(),
    players: z.array(z.object({ id: z.string(), name: z.string() })),
    setupData: z.unknown(),
    now: z.number(),
  }),
  // Server -> screen only: relays a controller's action for the screen's local reducer.
  z.object({ t: z.literal("gameAction"), playerId: z.string(), payload: z.unknown().optional(), now: z.number() }),
  // Relayed rtcSignal: fromPlayerId is set only when delivered to the screen (which peer this
  // came from); a controller only ever hears from the one screen, so it's absent there.
  z.object({ t: z.literal("rtcSignal"), fromPlayerId: z.string().optional(), data: z.unknown() }),
  z.object({ t: z.literal("error"), code: z.string(), message: z.string() }),
]);
export type ServerMessage = z.infer<typeof ServerMessageSchema>;

export function parseClientMessage(raw: string): ClientMessage {
  return ClientMessageSchema.parse(JSON.parse(raw));
}
export function parseServerMessage(raw: string): ServerMessage {
  return ServerMessageSchema.parse(JSON.parse(raw));
}
