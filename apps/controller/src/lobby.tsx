import type { CSSProperties } from "react";
import type { GameSummary, Player, Suggestion } from "@hubbub/protocol";
import { Avatar, GlowButton, NeutralButton, colorHex, colorName } from "@hubbub/ui";

export function ControllerLobby({
  players,
  hostId,
  games,
  cursorIndex,
  suggestions,
  playerId,
  isHost,
  onFocus,
  onConfirm,
  onTransferHost,
  onSuggest,
  onOpenSettings,
}: {
  players: Player[];
  hostId: string | null;
  games: GameSummary[];
  cursorIndex: number;
  suggestions: Suggestion[];
  playerId: string;
  isHost: boolean;
  onFocus: (i: number) => void;
  onConfirm: () => void;
  onTransferHost: (id: string) => void;
  onSuggest: (gameId: string) => void;
  onOpenSettings: () => void;
}) {
  const me = players.find((p) => p.id === playerId);
  const connectedCount = players.filter((p) => p.connected).length;
  const focusedGame = games[cursorIndex];

  const suggestersOf = (gameId: string) =>
    suggestions.filter((s) => s.gameId === gameId).map((s) => players.find((p) => p.id === s.playerId)).filter(Boolean) as Player[];

  return (
    <main style={page}>
      {me ? (
        <div style={identityHeader}>
          <Avatar size={52} colorHex={colorHex(me.colorId)} emoji={me.emoji} surface={1} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={identityName}>{me.name}</div>
            <div style={identitySub}>
              <span style={{ ...dot, background: colorHex(me.colorId) }} />
              {colorName(me.colorId)} · you{me.id === hostId ? " · host" : ""}
            </div>
          </div>
          <button type="button" onClick={onOpenSettings} style={editButton}>
            Edit
          </button>
        </div>
      ) : null}

      <div style={gameListSection}>
        <div style={sectionHeader}>
          <span style={sectionLabel}>PICK A GAME · {games.length}</span>
          <span style={sectionHint}>{isHost ? "you pick" : "host decides"}</span>
        </div>
        <div style={gameList}>
          {games.map((g, i) => {
            const focused = isHost && i === cursorIndex;
            const suggesters = suggestersOf(g.id);
            const mine = suggesters.some((p) => p.id === playerId);
            const [c1, c2] = g.identityColors ?? [1, 0];
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => (isHost ? onFocus(i) : onSuggest(g.id))}
                style={{
                  ...gameRow,
                  border: focused ? "1px solid var(--accent)" : "1px solid var(--divider)",
                  background: focused ? "rgba(145,132,217,.10)" : "var(--surface-1)",
                }}
              >
                <span style={pairDots}>
                  <span style={{ ...pairDot, background: colorHex(c1) }} />
                  <span style={{ ...pairDot, background: colorHex(c2) }} />
                </span>
                <span style={gameRowBody}>
                  <span style={gameTitle}>{g.name}</span>
                  <span style={gameMeta}>
                    {g.category ?? "Party"} · {g.minPlayers}
                    {g.maxPlayers ? `–${g.maxPlayers}` : "+"} players
                  </span>
                </span>
                {suggesters.length > 0 ? (
                  <span style={{ ...suggestPill, borderColor: mine ? "var(--player-amber)" : "rgba(255,176,32,.4)" }}>
                    {suggesters.slice(0, 3).map((p) => (
                      <span key={p.id}>{p.emoji}</span>
                    ))}
                    {suggesters.length}
                  </span>
                ) : !isHost ? (
                  <span style={voteHint}>vote</span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <div style={playerSection}>
        <div style={sectionHeader}>
          <span style={sectionLabel}>IN THE ROOM · {players.length}</span>
          <span style={sectionHint}>{connectedCount === players.length ? "all connected" : `${connectedCount} connected`}</span>
        </div>
        <div style={playerGrid}>
          {players.map((p) => (
            <div key={p.id} style={playerCell}>
              <Avatar size={44} colorHex={colorHex(p.colorId)} emoji={p.emoji} surface={1} disconnected={!p.connected} host={p.id === hostId} />
              <span style={playerName}>{p.name}</span>
              {isHost && p.connected && p.id !== playerId ? (
                <button type="button" onClick={() => onTransferHost(p.id)} style={makeHostButton}>
                  make host
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <div style={footer}>
        {isHost ? (
          <GlowButton
            height={60}
            label={focusedGame ? `Start ${focusedGame.name}` : "Pick a game"}
            disabled={!focusedGame}
            onClick={onConfirm}
          />
        ) : (
          <NeutralButton height={60} label="The host starts the game" disabled />
        )}
        <div style={caption}>Eyes on the TV — this stays in your pocket</div>
      </div>
    </main>
  );
}

const page: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  height: "100dvh",
  background: "var(--surface-0)",
  color: "var(--text-primary)",
};
const identityHeader: CSSProperties = {
  flex: "none",
  padding: "8px 16px 16px",
  borderBottom: "1px solid var(--divider)",
  display: "flex",
  alignItems: "center",
  gap: 12,
};
const identityName: CSSProperties = { font: "600 18px var(--font-ui)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
const identitySub: CSSProperties = { display: "flex", alignItems: "center", gap: 6, font: "500 12px var(--font-ui)", color: "var(--text-muted)" };
const dot: CSSProperties = { width: 8, height: 8, borderRadius: "50%", flex: "none" };
const editButton: CSSProperties = {
  flex: "none",
  font: "600 13px var(--font-ui)",
  color: "var(--accent)",
  background: "transparent",
  border: "1px solid rgba(145,132,217,.55)",
  borderRadius: "var(--radius-md)",
  padding: "8px 12px",
  cursor: "pointer",
};
const gameListSection: CSSProperties = { flex: 1, minHeight: 0, display: "flex", flexDirection: "column", padding: "0 16px 8px" };
const sectionHeader: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0 8px" };
const sectionLabel: CSSProperties = { font: "600 11px var(--font-ui)", letterSpacing: "0.14em", color: "var(--text-muted)" };
const sectionHint: CSSProperties = { font: "500 12px var(--font-ui)", color: "var(--text-faint)" };
const gameList: CSSProperties = { flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 };
const gameRow: CSSProperties = {
  minHeight: 64,
  borderRadius: "var(--radius-md)",
  padding: "12px 16px",
  display: "flex",
  alignItems: "center",
  gap: 12,
  textAlign: "left",
  cursor: "pointer",
  transition: "border-color 150ms ease-out, background 150ms ease-out",
};
const pairDots: CSSProperties = { flex: "none", display: "flex", flexDirection: "column", gap: 3 };
const pairDot: CSSProperties = { width: 10, height: 10, borderRadius: "50%" };
const gameRowBody: CSSProperties = { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 };
const gameTitle: CSSProperties = { font: "600 16px var(--font-ui)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
const gameMeta: CSSProperties = { font: "500 12px var(--font-ui)", color: "var(--text-muted)" };
const voteHint: CSSProperties = { flex: "none", font: "500 12px var(--font-ui)", color: "var(--text-faint)" };
const suggestPill: CSSProperties = {
  flex: "none",
  display: "flex",
  alignItems: "center",
  gap: 3,
  padding: "3px 8px",
  borderRadius: "var(--radius-pill)",
  background: "rgba(22,24,38,.85)",
  border: "1px solid",
  font: "600 11px var(--font-ui)",
  color: "var(--player-amber)",
};
const playerSection: CSSProperties = { flex: "none", borderTop: "1px solid var(--divider)", padding: "12px 16px" };
const playerGrid: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8, marginTop: 8 };
const playerCell: CSSProperties = { display: "flex", flexDirection: "column", alignItems: "center", gap: 4 };
const playerName: CSSProperties = {
  font: "500 11px var(--font-ui)",
  color: "var(--text-secondary)",
  maxWidth: 52,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};
const makeHostButton: CSSProperties = {
  font: "500 10px var(--font-ui)",
  color: "var(--accent)",
  background: "transparent",
  border: "none",
  padding: 0,
  cursor: "pointer",
};
const footer: CSSProperties = { flex: "none", padding: 16, borderTop: "1px solid var(--divider)" };
const caption: CSSProperties = { marginTop: 12, font: "400 12px var(--font-ui)", color: "var(--text-faint)", textAlign: "center" };
