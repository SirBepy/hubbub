import type { GameSummary, Player, Suggestion } from "@hubbub/protocol";

type Dir = "up" | "down" | "left" | "right";
export function ControllerLobby({
  players, hostId, games, cursorIndex, suggestions, playerId, isHost,
  onNav, onFocus, onConfirm, onTransferHost, onSuggest, onOpenSettings,
}: {
  players: Player[]; hostId: string | null; games: GameSummary[]; cursorIndex: number; suggestions: Suggestion[];
  playerId: string; isHost: boolean;
  onNav: (d: Dir) => void; onFocus: (i: number) => void; onConfirm: () => void;
  onTransferHost: (id: string) => void; onSuggest: (gameId: string) => void; onOpenSettings: () => void;
}) {
  const connectedCount = players.filter((p) => p.connected).length;
  const suggestersOf = (gameId: string) =>
    suggestions.filter((s) => s.gameId === gameId).map((s) => players.find((p) => p.id === s.playerId));
  const badge = (suggesters: (Player | undefined)[]) => suggesters.length > 0 && (
    <span style={{
      position: "absolute", top: -8, right: -6,
      display: "inline-flex", alignItems: "center", gap: 2,
      padding: "1px 6px", borderRadius: 999,
      background: "#22aa77", color: "#fff", fontSize: 10, fontWeight: 600,
    }}>
      {suggesters.map((p, j) => p && <span key={j}>{p.emoji}</span>)}
      {suggesters.length}
    </span>
  );
  return (
    <main style={{ fontFamily: "system-ui", padding: 16, maxWidth: 380, margin: "0 auto", textAlign: "center" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <strong>{isHost ? "You are host" : "Lobby"}</strong>
        <button onClick={onOpenSettings} aria-label="Settings" style={{ fontSize: 18 }}>⚙</button>
      </div>

      {isHost ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 48px)", gap: 6, justifyContent: "center", margin: "12px auto" }}>
            <span /><button onClick={() => onNav("up")} style={dpad}>↑</button><span />
            <button onClick={() => onNav("left")} style={dpad}>←</button>
            <button onClick={onConfirm} style={{ ...dpad, background: "#22aa77", color: "#fff" }}>OK</button>
            <button onClick={() => onNav("right")} style={dpad}>→</button>
            <span /><button onClick={() => onNav("down")} style={dpad}>↓</button><span />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
            {games.map((g, i) => {
              const playable = connectedCount >= g.minPlayers;
              return (
                <button key={g.id} disabled={!playable}
                  onClick={() => { onFocus(i); onConfirm(); }}
                  style={{ position: "relative", padding: 12, border: i === cursorIndex ? "3px solid #22aa77" : "2px solid #ccc", borderRadius: 10, opacity: playable ? 1 : 0.5 }}>
                  {badge(suggestersOf(g.id))}
                  <div style={{ fontWeight: 600 }}>{g.name}</div>
                  <div style={{ fontSize: 11, color: "#777" }}>{g.minPlayers}{g.maxPlayers ? `-${g.maxPlayers}` : "+"}</div>
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <>
          <p style={{ margin: "16px 0 8px" }}>Waiting for the host to pick a game… tap to suggest one</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
            {games.map((g) => {
              const mine = suggestions.some((s) => s.gameId === g.id && s.playerId === playerId);
              return (
                <button key={g.id} onClick={() => onSuggest(g.id)}
                  style={{ position: "relative", padding: 12, border: mine ? "3px solid #22aa77" : "2px solid #ccc", borderRadius: 10 }}>
                  {badge(suggestersOf(g.id))}
                  <div style={{ fontWeight: 600 }}>{g.name}</div>
                  <div style={{ fontSize: 11, color: "#777" }}>{g.minPlayers}{g.maxPlayers ? `-${g.maxPlayers}` : "+"}</div>
                </button>
              );
            })}
          </div>
        </>
      )}

      <h3>Players ({connectedCount})</h3>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {players.map((p) => (
          <li key={p.id} style={{ opacity: p.connected ? 1 : 0.4, display: "flex", gap: 8, alignItems: "center", justifyContent: "center", margin: 4 }}>
            <span style={{ fontSize: 20 }}>{p.emoji}</span>
            <span style={{ width: 12, height: 12, borderRadius: "50%", background: p.color }} />
            <span>{p.name}{p.id === playerId ? " (you)" : ""}</span>
            {p.id === hostId && <span style={{ fontSize: 11, color: "#22aa77" }}>★</span>}
            {isHost && p.connected && p.id !== playerId && (
              <button onClick={() => onTransferHost(p.id)} style={{ fontSize: 11 }}>Make host</button>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}

const dpad = { fontSize: 20, padding: 8, border: "2px solid #ccc", borderRadius: 8 } as const;
