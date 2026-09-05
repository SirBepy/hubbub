import type { CSSProperties } from "react";
import { CaretLeft, CaretRight, MagnifyingGlass } from "@phosphor-icons/react";
import type { GameSummary, Player, Suggestion } from "@hubbub/protocol";
import { IdentityHeader } from "./header";
import { GameRow, VoteBadge } from "./game-row";

/** Rows past this index still render, just without a stagger delay of their own - an unbounded
 * stagger on a long vote list would make the bottom rows land visibly late. */
const ROW_STAGGER_CAP = 8;

function votedGames(games: GameSummary[], suggestions: Suggestion[], players: Player[]) {
  return games
    .map((game) => ({
      game,
      voters: suggestions.filter((s) => s.gameId === game.id).map((s) => players.find((p) => p.id === s.playerId)).filter(Boolean) as Player[],
    }))
    .filter((row) => row.voters.length > 0)
    .sort((a, b) => b.voters.length - a.voters.length);
}

function clamp(i: number, max: number) {
  return Math.min(max, Math.max(0, i));
}

export function HostLobby({
  me,
  players,
  games,
  cursorIndex,
  suggestions,
  onFocus,
  onStart,
  onOpenMenu,
  onOpenSearch,
}: {
  me: Player;
  players: Player[];
  games: GameSummary[];
  cursorIndex: number;
  suggestions: Suggestion[];
  onFocus: (index: number) => void;
  onStart: () => void;
  onOpenMenu: () => void;
  onOpenSearch: () => void;
}) {
  const rows = votedGames(games, suggestions, players);
  const focused = games[cursorIndex];

  function play(gameId: string) {
    const index = games.findIndex((g) => g.id === gameId);
    if (index >= 0) onFocus(index);
    onStart();
  }

  return (
    <main className="hb-anim-deal" style={page}>
      <IdentityHeader name={me.name} avatarId={me.avatarId} isHost onOpenMenu={onOpenMenu} />
      <div style={body}>
        {rows.length === 0 ? (
          <p style={emptyHint}>No votes yet - open search to suggest a game.</p>
        ) : (
          rows.map(({ game, voters }, i) => (
            <div key={game.id} className="hb-anim-deal" style={{ "--i": Math.min(i, ROW_STAGGER_CAP) } as CSSProperties}>
              <GameRow
                game={game}
                meta={voters.map((v) => v.name).join(", ")}
                badge={<VoteBadge count={voters.length} active={game.id === focused?.id} label={voters.length === 1 ? "VOTE" : "VOTES"} />}
                highlight={game.id === focused?.id ? "tv" : undefined}
                onClick={() => play(game.id)}
              />
            </div>
          ))
        )}
      </div>
      <div style={footer}>
        <button type="button" onClick={onOpenSearch} style={searchField}>
          <MagnifyingGlass size={18} weight="bold" />
          Search games
        </button>
        <div style={remote}>
          <button type="button" aria-label="Previous" disabled={cursorIndex === 0} onClick={() => onFocus(clamp(cursorIndex - 1, games.length - 1))} style={arrow}>
            <CaretLeft size={22} weight="bold" />
          </button>
          <button type="button" onClick={onStart} disabled={!focused} style={play_}>
            <b style={playLabel}>PLAY</b>
            <span style={playName}>{focused?.name ?? "-"}</span>
          </button>
          <button type="button" aria-label="Next" disabled={cursorIndex >= games.length - 1} onClick={() => onFocus(clamp(cursorIndex + 1, games.length - 1))} style={arrow}>
            <CaretRight size={22} weight="bold" />
          </button>
        </div>
      </div>
    </main>
  );
}

export function PlayerLobby({
  me,
  playerId,
  players,
  hostId,
  games,
  suggestions,
  onSuggest,
  onOpenMenu,
  onOpenSearch,
}: {
  me: Player;
  playerId: string;
  players: Player[];
  hostId: string | null;
  games: GameSummary[];
  suggestions: Suggestion[];
  onSuggest: (gameId: string) => void;
  onOpenMenu: () => void;
  onOpenSearch: () => void;
}) {
  const rows = votedGames(games, suggestions, players);
  const hostName = players.find((p) => p.id === hostId)?.name ?? "The host";

  return (
    <main className="hb-anim-deal" style={page}>
      <IdentityHeader name={me.name} avatarId={me.avatarId} isHost={false} onOpenMenu={onOpenMenu} />
      <div style={body}>
        {rows.length === 0 ? (
          <p style={emptyHint}>No votes yet - open search to suggest a game.</p>
        ) : (
          rows.map(({ game, voters }, i) => {
            const mine = voters.some((v) => v.id === playerId);
            return (
              <div key={game.id} className="hb-anim-deal" style={{ "--i": Math.min(i, ROW_STAGGER_CAP) } as CSSProperties}>
                <GameRow
                  game={game}
                  meta={<VoterNames voters={voters} playerId={playerId} />}
                  badge={<VoteBadge count={voters.length} active={mine} label={mine ? "VOTED" : "VOTE"} />}
                  highlight={mine ? "mine" : undefined}
                  onClick={() => onSuggest(game.id)}
                />
              </div>
            );
          })
        )}
      </div>
      <div style={footer}>
        <button type="button" onClick={onOpenSearch} style={searchField}>
          <MagnifyingGlass size={18} weight="bold" />
          Search games
        </button>
        <div style={hint}>{hostName} is host and starts the game.</div>
      </div>
    </main>
  );
}

function VoterNames({ voters, playerId }: { voters: Player[]; playerId: string }) {
  return (
    <>
      {voters.map((v, i) => (
        <span key={v.id}>
          {i > 0 ? ", " : ""}
          {v.id === playerId ? <b style={{ color: "var(--ink-amber-highlight)" }}>You</b> : v.name}
        </span>
      ))}
    </>
  );
}

const page: CSSProperties = { display: "flex", flexDirection: "column", height: "100dvh", background: "var(--surface-0)", color: "var(--text-primary)" };
const body: CSSProperties = { flex: 1, minHeight: 0, overflowY: "auto", padding: "10px 14px 0", display: "flex", flexDirection: "column", gap: 9 };
const emptyHint: CSSProperties = { margin: "24px 0 0", textAlign: "center", font: "500 13px var(--font-ui)", color: "var(--text-faint)" };
const footer: CSSProperties = { flex: "none", padding: "10px 14px 18px", display: "flex", flexDirection: "column", gap: 9 };
const searchField: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 9,
  padding: "11px 12px",
  borderRadius: "var(--radius-lg)",
  background: "rgba(242,234,217,.06)",
  border: "1px solid var(--divider-heavy)",
  color: "var(--text-faint)",
  font: "500 14.5px var(--font-ui)",
  cursor: "pointer",
};
const hint: CSSProperties = { textAlign: "center", font: "500 11.5px var(--font-ui)", lineHeight: 1.45, color: "var(--text-muted)" };
const remote: CSSProperties = { display: "flex", gap: 9, alignItems: "stretch" };
const arrow: CSSProperties = {
  flex: "none",
  width: 62,
  borderRadius: "var(--radius-lg)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(242,234,217,.07)",
  border: "1px solid var(--divider-heavy)",
  color: "rgba(242,234,217,.75)",
  cursor: "pointer",
};
const play_: CSSProperties = {
  flex: 1,
  minWidth: 0,
  borderRadius: "var(--radius-lg)",
  padding: "10px 12px",
  textAlign: "center",
  background: "linear-gradient(180deg, var(--ink-amber-highlight), var(--ink-amber) 55%, #C8942A)",
  boxShadow: "0 4px 0 #8f6b1c",
  color: "#2A1A08",
  cursor: "pointer",
};
const playLabel: CSSProperties = { display: "block", font: "400 17px var(--font-display)", lineHeight: 1, letterSpacing: "0.05em" };
const playName: CSSProperties = {
  display: "block",
  marginTop: 3,
  font: "700 12px var(--font-ui)",
  color: "rgba(42,26,8,.66)",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};
