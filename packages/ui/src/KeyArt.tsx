import type { CSSProperties } from "react";

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export type KeyArtProps = {
  /** The game's claimed color pair, used as a faint low-alpha gradient. */
  pairHexes: [string, string];
  title: string;
  style?: CSSProperties;
};

/** Placeholder key art: no real art exists yet — a dark pair-tinted gradient with the game's initial. */
export function KeyArt({ pairHexes, title, style }: KeyArtProps) {
  const [a, b] = pairHexes;
  const initial = title.trim().charAt(0).toUpperCase();
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        background: `linear-gradient(135deg, ${hexToRgba(a, 0.16)}, var(--surface-sunken) 55%, ${hexToRgba(b, 0.16)})`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        ...style,
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "calc(var(--u)*9)",
          color: "rgba(242,234,217,.14)",
          lineHeight: 1,
        }}
      >
        {initial}
      </span>
    </div>
  );
}
