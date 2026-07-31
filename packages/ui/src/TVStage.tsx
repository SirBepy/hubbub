import { useEffect, useState } from "react";
import type { ReactNode } from "react";

const STAGE_WIDTH = 1920;
const STAGE_HEIGHT = 1080;

function computeScale(): number {
  if (typeof window === "undefined") return 1;
  return Math.min(window.innerWidth / STAGE_WIDTH, window.innerHeight / STAGE_HEIGHT);
}

/**
 * Fills the viewport, letterboxes, and renders a fixed 1920x1080 stage scaled
 * to fit. Every TV screen renders inside this.
 */
export function TVStage({ children }: { children: ReactNode }) {
  const [scale, setScale] = useState(computeScale);

  useEffect(() => {
    const onResize = () => setScale(computeScale());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: "var(--surface-0)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: STAGE_WIDTH,
          height: STAGE_HEIGHT,
          flex: "none",
          transform: `scale(${scale})`,
          transformOrigin: "center center",
          position: "relative",
          background: "var(--surface-0)",
        }}
      >
        {children}
      </div>
    </div>
  );
}
