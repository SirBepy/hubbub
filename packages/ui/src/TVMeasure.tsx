import type { CSSProperties, ReactNode } from "react";

/** Caps how wide TV content runs and centres it. A full-bleed row makes the room read
 *  across the whole wall, which is the one thing three metres away cannot do. */
export function TVMeasure({
  children,
  fill = false,
  style,
}: {
  children: ReactNode;
  /** Stretch to the parent's height, for a column that owns the whole stage. */
  fill?: boolean;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        width: "100%",
        maxWidth: "var(--tv-measure)",
        marginInline: "auto",
        minWidth: 0,
        ...(fill ? { height: "100%", minHeight: 0, display: "flex", flexDirection: "column" } : null),
        ...style,
      }}
    >
      {children}
    </div>
  );
}
