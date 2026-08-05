import type { CSSProperties } from "react";
import { colorHex, shadePair } from "./palette";

/** Box-lid art: one identity hue in light/dark shades, never the raw two-hue identity pair,
 * which blends into a rainbow (that pair exists for X-vs-O contrast, not for art). */
export function gameKeyArtHexes(identityColors?: number[]): [string, string] {
  return shadePair(colorHex(identityColors && identityColors.length ? identityColors[0] : 1));
}

export type KeyArtProps = {
  /** Same-hue light/dark shade pair (see shadePair) - a flat box-lid gradient, never two hues blended. */
  pairHexes: [string, string];
  title: string;
  style?: CSSProperties;
};

/** Placeholder key art: no real art exists yet - a saturated same-hue gradient with the game's initial. */
export function KeyArt({ pairHexes, title, style }: KeyArtProps) {
  const [light, dark] = pairHexes;
  const initial = title.trim().charAt(0).toUpperCase();
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        background: `linear-gradient(152deg, ${light} 0%, ${dark} 58%, var(--surface-sunken) 100%)`,
        display: "grid",
        placeItems: "center",
        ...style,
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "calc(var(--u)*9)",
          lineHeight: 1,
          letterSpacing: "-0.04em",
          color: "rgba(255,255,255,.09)",
        }}
      >
        {initial}
      </span>
    </div>
  );
}
