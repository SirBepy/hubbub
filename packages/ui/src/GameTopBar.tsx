import type { ReactNode } from "react";

export type GameTopBarProps = {
  /** Game wordmark, e.g. "NAME THAT TUNE". */
  title: string;
  /** The game's claimed pair — drives the hairline gradient under the wordmark. */
  pairHexes: [string, string];
  roomCode: string;
  /** Player pills (or other center content) for the round in progress. */
  children?: ReactNode;
};

/** Platform chrome for in-game TV screens (README screen 4 top bar, 112px). */
export function GameTopBar({ title, pairHexes, roomCode, children }: GameTopBarProps) {
  const [a, b] = pairHexes;
  return (
    <div
      style={{
        height: 112,
        flex: "none",
        background: "rgba(15,16,26,.72)",
        borderBottom: "1px solid rgba(233,233,237,.12)",
        padding: "0 48px",
        display: "flex",
        alignItems: "center",
        gap: 40,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: "none" }}>
        <div
          style={{
            font: "700 48px var(--font-display)",
            letterSpacing: "0.06em",
            color: "var(--text-primary)",
          }}
        >
          {title}
        </div>
        <div
          style={{
            height: 3,
            width: "100%",
            background: `linear-gradient(to right, ${a}, ${b})`,
          }}
        />
      </div>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
        {children}
      </div>
      <div
        style={{
          flex: "none",
          borderLeft: "1px solid rgba(233,233,237,.12)",
          padding: "0 0 0 32px",
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        <span style={{ font: "500 20px var(--font-ui)", letterSpacing: "0.08em", color: "var(--text-muted)" }}>
          HUBBUB.TV
        </span>
        <span style={{ font: "700 40px var(--font-display)", letterSpacing: "0.08em", color: "var(--text-primary)" }}>
          {roomCode}
        </span>
      </div>
    </div>
  );
}
