import { Avatar, NEUTRAL_RING } from "./Avatar";

export type PlayerPillProps = {
  colorHex: string;
  emoji: string;
};

/** The in-game top-bar pill (README screen 4, center row). */
export function PlayerPill({ colorHex, emoji }: PlayerPillProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 12px 6px 6px",
        borderRadius: "var(--radius-pill)",
        background: `${colorHex}1f`,
        border: `1px solid ${colorHex}`,
      }}
    >
      {/* size 40 matches the pill's prior fixed inner-circle diameter */}
      <Avatar size={40} colorHex={NEUTRAL_RING} emoji={emoji} surface={2} />
      <span style={{ width: 8, height: 8, flex: "none", borderRadius: "50%", background: colorHex }} />
    </div>
  );
}
