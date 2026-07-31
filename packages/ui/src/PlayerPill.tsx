export type PlayerPillProps = {
  colorHex: string;
  emoji: string;
  /** Locked in an answer: full color. Still thinking: dimmed to a neutral ring/dot. */
  locked: boolean;
};

/** The in-game top-bar pill (README screen 4, center row). */
export function PlayerPill({ colorHex, emoji, locked }: PlayerPillProps) {
  const ringColor = locked ? colorHex : "rgba(233,233,237,.14)";
  const dotColor = locked ? colorHex : "rgba(233,233,237,.22)";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 12px 6px 6px",
        borderRadius: "var(--radius-pill)",
        background: locked ? `${colorHex}1f` : "rgba(35,37,50,.7)",
        border: `1px solid ${ringColor}`,
        opacity: locked ? 1 : 0.45,
        transition: "opacity 150ms ease-out, background 150ms ease-out, border-color 150ms ease-out",
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          flex: "none",
          borderRadius: "50%",
          background: "rgba(15,16,26,.6)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 22,
          lineHeight: 1,
        }}
      >
        {emoji}
      </div>
      <span
        style={{
          width: 8,
          height: 8,
          flex: "none",
          borderRadius: "50%",
          background: dotColor,
          transition: "background 150ms ease-out",
        }}
      />
    </div>
  );
}
