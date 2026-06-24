import { z } from "zod";

export const PlayerSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(24),
  connected: z.boolean(),
});
export type Player = z.infer<typeof PlayerSchema>;

// Client -> Server
export const ClientMessageSchema = z.discriminatedUnion("t", [
  z.object({ t: z.literal("createRoom") }),
  z.object({
    t: z.literal("joinRoom"),
    code: z.string().length(4),
    name: z.string().min(1).max(24),
    token: z.string().optional(),
  }),
  z.object({ t: z.literal("action"), payload: z.unknown().optional() }),
]);
export type ClientMessage = z.infer<typeof ClientMessageSchema>;

// Server -> Client
export const ServerMessageSchema = z.discriminatedUnion("t", [
  z.object({ t: z.literal("roomCreated"), code: z.string().length(4) }),
  z.object({ t: z.literal("joined"), playerId: z.string(), token: z.string() }),
  z.object({ t: z.literal("roomState"), players: z.array(PlayerSchema) }),
  z.object({ t: z.literal("gameState"), state: z.unknown() }),
  z.object({ t: z.literal("error"), code: z.string(), message: z.string() }),
]);
export type ServerMessage = z.infer<typeof ServerMessageSchema>;

export function parseClientMessage(raw: string): ClientMessage {
  return ClientMessageSchema.parse(JSON.parse(raw));
}
export function parseServerMessage(raw: string): ServerMessage {
  return ServerMessageSchema.parse(JSON.parse(raw));
}
