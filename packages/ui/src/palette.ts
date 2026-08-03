/**
 * The one place player-identity hexes live. Fixed six, join-order, never extended.
 * Sibling game repos depend on the names/ids/order: retune hexes only.
 */
export const PLAYER_COLORS = [
  { id: 0, name: "magenta", hex: "#D97BA8" },
  { id: 1, name: "cyan", hex: "#3E8F86" },
  { id: 2, name: "lime", hex: "#5FA046" },
  { id: 3, name: "amber", hex: "#E4B33C" },
  { id: 4, name: "violet", hex: "#8E6BC0" },
  { id: 5, name: "blue", hex: "#4C7FC0" },
] as const;

export type PlayerColor = (typeof PLAYER_COLORS)[number];

/** Cycles with modulo so color ids beyond the fixed six (or negative) stay safe. */
function resolve(colorId: number): PlayerColor {
  const index = ((colorId % PLAYER_COLORS.length) + PLAYER_COLORS.length) % PLAYER_COLORS.length;
  return PLAYER_COLORS[index];
}

export function colorHex(colorId: number): string {
  return resolve(colorId).hex;
}

export function colorName(colorId: number): string {
  return resolve(colorId).name;
}
