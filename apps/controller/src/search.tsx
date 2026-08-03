import { useMemo, useState, type CSSProperties } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react";
import type { GameSummary, Suggestion } from "@hubbub/protocol";
import { BackHeader } from "./header";
import { GameRow, VoteBadge } from "./game-row";

function playersLabel(g: GameSummary): string {
  if (g.maxPlayers === undefined) return `${g.minPlayers}+ players`;
  if (g.maxPlayers === g.minPlayers) return `${g.minPlayers} players`;
  return `${g.minPlayers}-${g.maxPlayers} players`;
}

export function SearchScreen({
  games,
  suggestions,
  playerId,
  onSuggest,
  onBack,
}: {
  games: GameSummary[];
  suggestions: Suggestion[];
  playerId: string;
  onSuggest: (gameId: string) => void;
  onBack: () => void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const categories = useMemo(() => Array.from(new Set(games.map((g) => g.category).filter(Boolean))) as string[], [games]);

  const q = query.trim().toLowerCase();
  const results = games.filter((g) => (!category || g.category === category) && (!q || g.name.toLowerCase().includes(q)));

  return (
    <main style={page}>
      <BackHeader title="All games" onBack={onBack} />
      <div style={sbox}>
        <div style={{ ...searchField, ...(query ? searchFieldLive : null) }}>
          <MagnifyingGlass size={18} weight="bold" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search games" style={input} />
        </div>
        <div style={chips}>
          <button type="button" onClick={() => setCategory(null)} style={{ ...chip, ...(category === null ? chipOn : null) }}>
            All
          </button>
          {categories.map((c) => (
            <button key={c} type="button" onClick={() => setCategory(c)} style={{ ...chip, ...(category === c ? chipOn : null) }}>
              {c}
            </button>
          ))}
        </div>
      </div>
      <div style={body}>
        {results.map((g) => {
          const voters = suggestions.filter((s) => s.gameId === g.id);
          const mine = voters.some((s) => s.playerId === playerId);
          return (
            <GameRow
              key={g.id}
              game={g}
              meta={`${g.category ?? "Party"} · ${playersLabel(g)}`}
              badge={<VoteBadge count={mine ? voters.length : voters.length || "·"} active={mine} label={mine ? "VOTED" : "VOTE"} />}
              highlight={mine ? "mine" : undefined}
              onClick={() => {
                onSuggest(g.id);
                onBack();
              }}
            />
          );
        })}
      </div>
      <div style={footer}>
        <div style={hint}>Voting takes you back to the lobby.</div>
      </div>
    </main>
  );
}

const page: CSSProperties = { display: "flex", flexDirection: "column", height: "100dvh", background: "var(--surface-0)", color: "var(--text-primary)" };
const sbox: CSSProperties = { flex: "none", padding: "10px 14px 0", display: "flex", flexDirection: "column", gap: 8 };
const searchField: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 9,
  padding: "11px 12px",
  borderRadius: "var(--radius-lg)",
  background: "rgba(242,234,217,.06)",
  border: "1px solid var(--divider-heavy)",
  color: "var(--text-faint)",
};
const searchFieldLive: CSSProperties = { borderColor: "var(--ink-amber-highlight)", background: "rgba(247,207,99,.08)", color: "var(--text-primary)" };
const input: CSSProperties = { flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none", color: "inherit", font: "500 14.5px var(--font-ui)" };
const chips: CSSProperties = { display: "flex", gap: 7, flexWrap: "wrap" };
const chip: CSSProperties = {
  padding: "6px 12px",
  borderRadius: "var(--radius-pill)",
  font: "600 12px var(--font-ui)",
  border: "1px solid var(--divider-heavy)",
  color: "var(--text-secondary)",
  background: "transparent",
  cursor: "pointer",
};
const chipOn: CSSProperties = { background: "var(--accent)", color: "#2A1A08", borderColor: "transparent", fontWeight: 700 };
const body: CSSProperties = { flex: 1, minHeight: 0, overflowY: "auto", padding: "9px 14px 0", display: "flex", flexDirection: "column", gap: 9 };
const footer: CSSProperties = { flex: "none", padding: "10px 14px 18px" };
const hint: CSSProperties = { textAlign: "center", font: "500 11.5px var(--font-ui)", lineHeight: 1.45, color: "var(--text-muted)" };
