export type SuggestionBadgeProps = {
  emoji: string;
  label: string;
  count: number;
};

/** Amber "ROOM PICK" pill — the catalog tile badge for the community-voted suggestion. */
export function SuggestionBadge({ emoji, label, count }: SuggestionBadgeProps) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 12px",
        borderRadius: "var(--radius-pill)",
        background: "rgba(10,13,9,.85)",
        border: "1px solid rgba(228,179,60,.7)",
        font: "600 18px var(--font-ui)",
        color: "var(--player-amber)",
      }}
    >
      <span>{emoji}</span>
      <span>
        {label} · {count}
      </span>
    </div>
  );
}
