/** The one place player-identity hexes live. Fixed six, join-order, never extended. */
export const PLAYER_COLORS = [
  { id: 0, name: "magenta", hex: "#FF3D9A" },
  { id: 1, name: "cyan", hex: "#22E0E8" },
  { id: 2, name: "lime", hex: "#A8F03C" },
  { id: 3, name: "amber", hex: "#FFB020" },
  { id: 4, name: "violet", hex: "#B48CFF" },
  { id: 5, name: "blue", hex: "#4C8DFF" },
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
