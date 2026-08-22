import type { GameIconEntry } from "./game-icons";
import type { FluentEmojiEntry } from "./fluent-emoji";
import type { TwemojiEntry } from "./twemoji";
import { isAvatarCharacterId } from "./catalog";

export type ResolvedAvatarCharacter =
  | { kind: "gi"; id: string; label: string; d: string }
  | { kind: "fe" | "tw"; id: string; label: string; viewBox: string; markup: string };

// Each ~15-60kB (uncompressed) of art data. Split per-set so the eager bundle carries none of
// it; resolveAvatarCharacter loads the owning set's chunk on first use of any of its ids.
let giPromise: Promise<Map<string, GameIconEntry>> | null = null;
let fePromise: Promise<Map<string, FluentEmojiEntry>> | null = null;
let twPromise: Promise<Map<string, TwemojiEntry>> | null = null;

function loadGi() {
  return (giPromise ??= import("./game-icons").then((m) => new Map(m.GAME_ICONS.map((e) => [e.id, e]))));
}
function loadFe() {
  return (fePromise ??= import("./fluent-emoji").then((m) => new Map(m.FLUENT_EMOJI.map((e) => [e.id, e]))));
}
function loadTw() {
  return (twPromise ??= import("./twemoji").then((m) => new Map(m.TWEMOJI.map((e) => [e.id, e]))));
}

const SYNC_CACHE = new Map<string, ResolvedAvatarCharacter>();

/** Cache-only lookup, safe during render. Null until resolveAvatarCharacter has resolved this id. */
export function resolveAvatarCharacterSync(value: string): ResolvedAvatarCharacter | null {
  return SYNC_CACHE.get(value) ?? null;
}

/** Resolves a namespaced avatar id to bundled artwork, loading its set's chunk on first use. */
export async function resolveAvatarCharacter(value: string): Promise<ResolvedAvatarCharacter | null> {
  const cached = SYNC_CACHE.get(value);
  if (cached) return cached;
  if (!isAvatarCharacterId(value)) return null;

  const setId = value.slice(0, value.indexOf(":"));
  const map = setId === "gi" ? await loadGi() : setId === "fe" ? await loadFe() : setId === "tw" ? await loadTw() : null;
  const raw = map?.get(value);
  if (!raw) return null;

  const resolved: ResolvedAvatarCharacter =
    "d" in raw
      ? { kind: "gi", id: raw.id, label: raw.label, d: raw.d }
      : { kind: setId as "fe" | "tw", id: raw.id, label: raw.label, viewBox: raw.viewBox, markup: raw.markup };
  SYNC_CACHE.set(value, resolved);
  return resolved;
}

// Fires as soon as any Avatar is imported (app boot), so the three chunks are usually already
// warm in the sync cache by the time a component actually needs one - no visible pop-in.
void loadGi();
void loadFe();
void loadTw();
