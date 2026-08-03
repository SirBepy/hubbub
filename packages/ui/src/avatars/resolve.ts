import { GAME_ICONS } from "./game-icons";
import { FLUENT_EMOJI } from "./fluent-emoji";
import { TWEMOJI } from "./twemoji";

const GI_MAP = new Map(GAME_ICONS.map((e) => [e.id, e]));
const FE_MAP = new Map(FLUENT_EMOJI.map((e) => [e.id, e]));
const TW_MAP = new Map(TWEMOJI.map((e) => [e.id, e]));

export type ResolvedAvatarCharacter =
  | { kind: "gi"; id: string; label: string; d: string }
  | { kind: "fe" | "tw"; id: string; label: string; viewBox: string; markup: string };

/** Resolves a namespaced avatar id to bundled artwork, or null for a plain emoji/unknown string. */
export function resolveAvatarCharacter(value: string): ResolvedAvatarCharacter | null {
  const gi = GI_MAP.get(value);
  if (gi) return { kind: "gi", ...gi };
  const fe = FE_MAP.get(value);
  if (fe) return { kind: "fe", ...fe };
  const tw = TW_MAP.get(value);
  if (tw) return { kind: "tw", ...tw };
  return null;
}
