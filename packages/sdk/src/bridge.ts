import { z } from "zod";
import type { DisplayPlayer, GameLogic } from "./types.js";

/** Bootstrap tag. The shell's one and only `postMessage(..., "*")` carries this plus the port,
 * so its payload is restricted to `PlayerInfo` - no token, no colorId, no avatarId (S12). */
export const BOOTSTRAP_TYPE = "hubbub-init";

/** What a game's bundle default-exports. Declared here rather than beside defineGameBundle so
 * the sandbox frame document can name the type without pulling ReactDOM onto the sandbox origin. */
export interface GameBundle {
  logic: GameLogic<any, any>;
  /** Called by the sandbox frame document once it holds the port. Never called by game code. */
  attach(opts: { root: HTMLElement; port: MessagePort; role: SandboxRole }): void;
}

export const SandboxRoleSchema = z.enum(["screen", "controller"]);
export type SandboxRole = z.infer<typeof SandboxRoleSchema>;

/** The narrow shape the bootstrap may carry. Mirrors the SDK's `PlayerInfo`. */
export const PlayerInfoSchema = z.object({ id: z.string(), name: z.string() }).strict();

/** Richer roster for rendering, sent only over the MessagePort capability. Identical to
 * protocol's wire `Player`, which holds no token - the port is not reachable by another window,
 * unlike the `"*"` bootstrap above. */
export const DisplayPlayerSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    colorId: z.number().int(),
    avatarId: z.string(),
    connected: z.boolean(),
  })
  .strict();

// Ties the schema to `DisplayPlayer` in both directions so an added/removed field fails `tsc`
// instead of only surfacing as `.strict()` silently dropping roster data at the frame boundary.
// One direction alone is not enough: a field added to the interface but not the schema is only
// caught by assigning the schema's inferred type TO the interface (below), while a field added
// to the schema but not the interface is only caught by the reverse assignment.
const _displayPlayerFromSchema: DisplayPlayer = {} as z.infer<typeof DisplayPlayerSchema>;
const _displayPlayerToSchema: z.infer<typeof DisplayPlayerSchema> = {} as DisplayPlayer;
void _displayPlayerFromSchema;
void _displayPlayerToSchema;

export const BootstrapSchema = z
  .object({
    t: z.literal(BOOTSTRAP_TYPE),
    role: SandboxRoleSchema,
    players: z.array(PlayerInfoSchema),
  })
  .strict();
export type Bootstrap = z.infer<typeof BootstrapSchema>;

const GameResultSchema = z
  .object({
    winnerId: z.string().nullable(),
    isDraw: z.boolean(),
    standings: z
      .array(z.object({ playerId: z.string(), position: z.number().int(), score: z.number().optional() }).strict())
      .optional(),
  })
  .strict();

/** Shell -> frame. `launch`/`action`/`playersChanged`/`timeout` drive the screen-role reducer;
 * `state` feeds a controller-role frame, which never runs one. */
export const ShellToFrameSchema = z.discriminatedUnion("t", [
  z.object({
    t: z.literal("launch"),
    players: z.array(DisplayPlayerSchema),
    setupData: z.unknown(),
    now: z.number(),
  }),
  z.object({ t: z.literal("action"), playerId: z.string(), action: z.unknown(), now: z.number() }),
  z.object({ t: z.literal("playersChanged"), players: z.array(DisplayPlayerSchema) }),
  z.object({ t: z.literal("timeout"), now: z.number() }),
  z.object({ t: z.literal("state"), state: z.unknown(), playerId: z.string() }),
]);
export type ShellToFrame = z.infer<typeof ShellToFrameSchema>;

/** Frame -> shell. Everything here is untrusted input authored by the game. */
export const FrameToShellSchema = z.discriminatedUnion("t", [
  z.object({ t: z.literal("ready") }),
  z.object({ t: z.literal("state"), state: z.unknown() }),
  // Nullable, never optional: a game clearing its deadline must be distinguishable from a
  // malformed message that dropped the field.
  z.object({ t: z.literal("deadline"), at: z.number().nullable() }),
  z.object({ t: z.literal("result"), result: GameResultSchema.nullable() }),
  z.object({ t: z.literal("action"), action: z.unknown() }),
  z.object({ t: z.literal("error"), message: z.string().max(500) }),
]);
export type FrameToShell = z.infer<typeof FrameToShellSchema>;

/** Hard floor on a game's state payload, applied to the serialized bytes before the declared
 * `stateSchema` runs, so a bundle declaring `z.unknown()` cannot widen it (S6). Sized against
 * Durable Object storage, whose per-value ceiling is 128 KiB and which holds this same blob as
 * the Phase D backup. */
export const MAX_STATE_BYTES = 64 * 1024;

export function stateWithinCap(state: unknown): boolean {
  let json: string;
  try {
    json = JSON.stringify(state);
  } catch {
    return false; // a cycle, or a BigInt: not serializable, so not broadcastable either
  }
  if (json === undefined) return false;
  return new TextEncoder().encode(json).length <= MAX_STATE_BYTES;
}

/** Frame-document half of the bootstrap. Accepts the first message that came from the parent
 * carrying exactly one port, then stops listening - an opaque origin makes `event.origin` the
 * shared string "null", so the port itself is the only usable identity (2026-08-08 record, 2.4). */
export function awaitBootstrap(win: Window = window): Promise<{ port: MessagePort; role: SandboxRole }> {
  return new Promise((resolve) => {
    function onMessage(event: MessageEvent) {
      if (event.source !== win.parent || event.ports.length !== 1) return;
      const parsed = BootstrapSchema.safeParse(event.data);
      if (!parsed.success || parsed.data.t !== BOOTSTRAP_TYPE) return;
      win.removeEventListener("message", onMessage);
      resolve({ port: event.ports[0]!, role: parsed.data.role });
    }
    win.addEventListener("message", onMessage);
  });
}
