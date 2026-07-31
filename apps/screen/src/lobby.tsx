import type { GameSummary, Player, Suggestion } from "@hubbub/protocol";

export function Lobby({
  code, qr, controllerLabel, players, hostId, games, cursorIndex, suggestions,
}: {
  code: string;
  qr: string;
  controllerLabel: string;
  players: Player[];
  hostId: string | null;
  games: GameSummary[];
  cursorIndex: number;
  suggestions: Suggestion[];
}) {
  const connectedCount = players.filter((p) => p.connected).length;
  const featured = games.filter((g) => g.featured);
  const suggestersOf = (gameId: string) =>
    suggestions.filter((s) => s.gameId === gameId).map((s) => players.find((p) => p.id === s.playerId));

  return (
    <div style={{ fontFamily: "system-ui", textAlign: "center" }}>
      {featured.length > 0 && (
        <div style={{ display: "flex", gap: 12, overflowX: "auto", padding: "8px 16px", justifyContent: "center" }}>
          {featured.map((g) => (
            <div key={g.id} style={{ minWidth: 180, padding: 16, border: "2px solid #ddd", borderRadius: 12, background: "#fafafa" }}>
              <strong>{g.name}</strong>
              <div style={{ fontSize: 12, color: "#777" }}>{g.minPlayers}{g.maxPlayers ? `-${g.maxPlayers}` : "+"} players</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, maxWidth: 540, margin: "16px auto" }}>
        {games.map((g, i) => {
          const playable = connectedCount >= g.minPlayers;
          const focused = i === cursorIndex;
          const suggesters = suggestersOf(g.id);
          return (
            <div key={g.id} style={{
              position: "relative",
              padding: 20,
              border: focused ? "3px solid #22aa77" : "2px solid #ccc",
              borderRadius: 12,
              opacity: playable ? 1 : 0.45,
              background: focused ? "#eafff6" : "#fff",
            }}>
              {suggesters.length > 0 && (
                <span title="Suggested by players" style={{
                  position: "absolute", top: -10, right: -8,
                  display: "inline-flex", alignItems: "center", gap: 4,
                  padding: "2px 8px", borderRadius: 999,
                  background: "#22aa77", color: "#fff", fontSize: 12, fontWeight: 600,
                }}>
                  {suggesters.map((p, j) => p && <span key={j}>{p.emoji}</span>)}
                  {suggesters.length}
                </span>
              )}
              <div style={{ fontSize: 18, fontWeight: 600 }}>{g.name}</div>
              <div style={{ fontSize: 12, color: "#777" }}>
                {g.minPlayers}{g.maxPlayers ? `-${g.maxPlayers}` : "+"} players{playable ? "" : " - need more"}
              </div>
            </div>
          );
        })}
      </div>

      <p>Join at <strong>{controllerLabel}</strong></p>
      <h2 style={{ fontSize: 48, letterSpacing: 8 }}>{code || "…"}</h2>
      {qr && <img src={qr} alt="Join QR" width={180} height={180} />}

      <h3>Players ({connectedCount})</h3>
      <ul style={{ listStyle: "none", padding: 0, display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
        {players.map((p) => (
          <li key={p.id} style={{ opacity: p.connected ? 1 : 0.4, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 22 }}>{p.emoji}</span>
            <span style={{ width: 12, height: 12, borderRadius: "50%", background: p.color, display: "inline-block" }} />
            <span>{p.name}</span>
            {p.id === hostId && <span title="Host" style={{ fontSize: 12, color: "#22aa77" }}>★ host</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
