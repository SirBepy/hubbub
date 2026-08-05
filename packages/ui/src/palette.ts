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

function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
  else if (max === g) h = ((b - r) / d + 2) * 60;
  else h = ((r - g) / d + 4) * 60;
  return [h, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r0, g0, b0] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  const to255 = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, "0");
  return `#${to255(r0)}${to255(g0)}${to255(b0)}`;
}

/** One identity hue, two shades - the "box lid" look. Never blend two unrelated
 * palette hues into a gradient; that reads as a rainbow, not a game's color. */
export function shadePair(hex: string): [string, string] {
  const [h, s, l] = hexToHsl(hex);
  return [hex, hslToHex(h, Math.min(1, s * 1.05), l * 0.62)];
}

export function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
