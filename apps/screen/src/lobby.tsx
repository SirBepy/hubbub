import type { GameSummary, Player, Suggestion } from "@hubbub/protocol";
import { Avatar, KeyArt, colorHex, gameKeyArtHexes } from "@hubbub/ui";
import { User } from "@phosphor-icons/react";

function playerCountLabel(g: GameSummary): string {
  if (g.maxPlayers === undefined) return `${g.minPlayers}+ players`;
  if (g.maxPlayers === g.minPlayers) return `${g.minPlayers} players`;
  return `${g.minPlayers}-${g.maxPlayers} players`;
}

function tileMeta(g: GameSummary): string {
  const range = g.maxPlayers && g.maxPlayers !== g.minPlayers ? `${g.minPlayers}-${g.maxPlayers}` : `${g.minPlayers}+`;
  return g.category ? `${g.category} · ${range}` : range;
}

function gamePairHexes(g: GameSummary): [string, string] {
  return gameKeyArtHexes(g.identityColors);
}

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
  const focused = games[cursorIndex] ?? null;
  const suggestersOf = (gameId: string) =>
    suggestions.filter((s) => s.gameId === gameId).map((s) => players.find((p) => p.id === s.playerId)).filter(Boolean) as Player[];
  const voteCountOf = (gameId: string) => suggestions.filter((s) => s.gameId === gameId).length;
  const votedGames = games
    .map((g) => ({ game: g, voters: suggestersOf(g.id) }))
    .filter((row) => row.voters.length > 0)
    .sort((a, b) => b.voters.length - a.voters.length);

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: "grid",
        gridTemplateColumns: "minmax(0,1fr) clamp(230px, 19vw, 380px)",
        gridTemplateRows: "auto minmax(0,1fr) auto auto",
        gridTemplateAreas: '"top top" "hero votes" "row row" "rail rail"',
        gap: "calc(var(--u)*1.1) calc(var(--u)*1.4)",
        padding: "calc(var(--u)*1.5) calc(var(--u)*2) calc(var(--u)*1)",
        minWidth: 0,
        color: "var(--text-primary)",
      }}
    >
      {/* Top: wordmark + join card */}
      <div style={{ gridArea: "top", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--u)", minWidth: 0, minHeight: 0 }}>
        <div
          style={{
            fontFamily: "var(--font-display)", fontSize: "calc(var(--u)*2.6)", lineHeight: 0.88,
            letterSpacing: "-0.02em", color: "#f7f1e2",
            textShadow: "0 2px 0 #6b5a37, 0 3px 0 rgba(0,0,0,.55), 0 10px 26px rgba(0,0,0,.5)",
          }}
        >
          HUB<span style={{ color: "var(--accent)" }}>BUB</span>
        </div>

        <div
          style={{
            flex: "none", display: "flex", alignItems: "stretch", gap: "calc(var(--u)*.7)",
            padding: "calc(var(--u)*.5)", borderRadius: "calc(var(--u)*.5)",
            background: "linear-gradient(180deg,var(--kraft-light),var(--kraft-mid) 55%,var(--kraft-dark))",
            boxShadow: "0 3px 0 #7d6242, 0 calc(var(--u)*.7) calc(var(--u)*1.4) rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.45)",
          }}
        >
          <div
            style={{
              width: "calc(var(--u)*4.4)", height: "calc(var(--u)*4.4)", flex: "none",
              background: "#f4efe2", borderRadius: "calc(var(--u)*.25)", padding: "calc(var(--u)*.25)",
            }}
          >
            {qr ? <img src={qr} alt="Join QR" style={{ display: "block", width: "100%", height: "100%" }} /> : null}
          </div>
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", textAlign: "center", padding: "0 calc(var(--u)*.7)" }}>
            <div style={{ fontSize: "calc(var(--u)*.7)", letterSpacing: "0.24em", fontWeight: 700, color: "var(--kraft-ink-mid)", textTransform: "uppercase" }}>
              Join anytime
            </div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: "calc(var(--u)*2.8)", lineHeight: 0.98, letterSpacing: "0.1em", color: "var(--kraft-ink)" }}>
              {code || "…"}
            </div>
            <div style={{ fontSize: "calc(var(--u)*.76)", fontWeight: 600, color: "var(--kraft-ink-mid)" }}>{controllerLabel}</div>
          </div>
        </div>
      </div>

      {/* Hero: focused game */}
      <div
        style={{
          gridArea: "hero", display: "grid", gridTemplateColumns: "minmax(0,1.2fr) minmax(0,1fr)",
          overflow: "hidden", borderRadius: "calc(var(--u)*.7)", border: "1px solid rgba(0,0,0,.6)",
          background: "linear-gradient(180deg,#2a2118,#1b1610)",
          boxShadow: "0 calc(var(--u)*1) calc(var(--u)*2.4) rgba(0,0,0,.6), inset 0 2px 0 rgba(255,255,255,.07)",
          minWidth: 0, minHeight: 0,
        }}
      >
        {focused ? (
          <>
            <div style={{ minWidth: 0, minHeight: 0, overflow: "hidden", padding: "calc(var(--u)*1.5)", display: "flex", flexDirection: "column", justifyContent: "center", gap: "calc(var(--u)*.6)" }}>
              <div style={{ fontSize: "calc(var(--u)*.8)", letterSpacing: "0.3em", fontWeight: 700, color: "var(--accent)", textTransform: "uppercase" }}>
                {focused.category ? `${focused.category} · ${playerCountLabel(focused)}` : playerCountLabel(focused)}
              </div>
              <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "calc(var(--u)*3.5)", lineHeight: 0.92, letterSpacing: "-0.025em", color: "#f7f1e2" }}>
                {focused.name}
              </h1>
              {focused.description ? (
                <p
                  style={{
                    margin: 0, fontFamily: "var(--font-ui)", fontSize: "calc(var(--u)*1)", fontWeight: 500,
                    lineHeight: 1.35, color: "var(--text-secondary)",
                    display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
                  }}
                >
                  {focused.description}
                </p>
              ) : null}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "calc(var(--u)*.45)" }}>
                <span
                  style={{
                    padding: "calc(var(--u)*.3) calc(var(--u)*.8)", borderRadius: "999px",
                    border: "2px solid var(--text-faint)", fontSize: "calc(var(--u)*.86)", fontWeight: 600,
                    color: "var(--text-secondary)",
                  }}
                >
                  {playerCountLabel(focused)}
                </span>
              </div>
            </div>
            <KeyArt pairHexes={gamePairHexes(focused)} title={focused.name} style={{ minWidth: 0, minHeight: 0 }} />
          </>
        ) : null}
      </div>

      {/* Vote rack: color swatch, name, voter names, tally - no "votes" label */}
      <div style={{ gridArea: "votes", display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0, minHeight: 0 }}>
        <div style={{ marginTop: "calc(var(--u)*.7)", display: "flex", flexDirection: "column", gap: "calc(var(--u)*.55)", overflow: "hidden", minHeight: 0 }}>
          {votedGames.length === 0 ? (
            <div
              style={{
                flex: "none", padding: "calc(var(--u)*.5) calc(var(--u)*.7)", borderRadius: "calc(var(--u)*.35)",
                border: "1px dashed var(--divider-heavy)", color: "var(--text-muted)",
                fontSize: "calc(var(--u)*.82)", fontWeight: 600, lineHeight: 1.3,
              }}
            >
              No suggestions yet. Players vote from their phones.
            </div>
          ) : null}
          {votedGames.map(({ game, voters }) => {
            const [hexA, hexB] = gamePairHexes(game);
            return (
              <div
                key={game.id}
                style={{
                  display: "flex", alignItems: "center", gap: "calc(var(--u)*.65)", flex: "none",
                  padding: "calc(var(--u)*.5) calc(var(--u)*.7)", borderRadius: "calc(var(--u)*.35)",
                  background: "linear-gradient(180deg,var(--kraft-light),var(--kraft-vote-dark))", color: "var(--kraft-ink)",
                  boxShadow: "0 calc(var(--u)*.35) calc(var(--u)*.8) rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.4)",
                }}
              >
                <span style={{ flex: "none", width: "calc(var(--u)*1.3)", height: "calc(var(--u)*1.7)", borderRadius: "calc(var(--u)*.15)", background: `linear-gradient(180deg,${hexA},${hexB})` }} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontFamily: "var(--font-display)", fontSize: "calc(var(--u)*.98)", lineHeight: 1.05, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {game.name}
                  </span>
                  <span
                    style={{
                      display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
                      fontFamily: "var(--font-ui)", fontWeight: 600, fontSize: "calc(var(--u)*.72)", color: "rgba(59,42,20,.62)",
                      marginTop: 1, lineHeight: 1.25,
                    }}
                  >
                    {voters.map((v) => v.name).join(", ")}
                  </span>
                </span>
                <span
                  style={{
                    flex: "none", display: "flex", alignItems: "center", gap: "calc(var(--u)*.22)",
                    padding: "calc(var(--u)*.22) calc(var(--u)*.55)", borderRadius: "999px", background: "var(--kraft-ink)",
                    color: "var(--ink-amber-highlight)", fontFamily: "var(--font-display)", fontSize: "calc(var(--u)*.95)", lineHeight: 1.2,
                  }}
                >
                  <User weight="fill" size="1em" style={{ fontSize: "calc(var(--u)*.9)" }} />
                  {voters.length}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* All games, horizontal - never rotated/vertical text */}
      <div style={{ gridArea: "row", overflow: "hidden", minWidth: 0, minHeight: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "calc(var(--u)*.5)" }}>
          <h2 style={{ margin: 0, fontSize: "calc(var(--u)*.8)", letterSpacing: "0.26em", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
            All games · {games.length}
          </h2>
        </div>
        <div style={{ display: "flex", gap: "calc(var(--u)*.8)", overflow: "hidden", padding: "calc(var(--u)*.5) 0 calc(var(--u)*.6)" }}>
          {games.map((g, i) => {
            const isFocused = i === cursorIndex;
            const votes = voteCountOf(g.id);
            const [hexA, hexB] = gamePairHexes(g);
            return (
              <div
                key={g.id}
                style={{
                  position: "relative", flex: "none", width: "calc(var(--u)*10.5)", borderRadius: "calc(var(--u)*.4)",
                  overflow: "hidden",
                  background: isFocused ? "color-mix(in srgb, var(--ink-amber-highlight) 10%, transparent)" : "rgba(242,234,217,.05)",
                  border: isFocused ? "1px solid var(--ink-amber-highlight)" : "1px solid var(--divider)",
                  boxShadow: isFocused ? "0 0 calc(var(--u)*1.6) color-mix(in srgb, var(--ink-amber-highlight) 25%, transparent)" : "none",
                }}
              >
                <div style={{ height: "calc(var(--u)*3.2)", background: `linear-gradient(160deg,${hexA},${hexB})` }} />
                {votes > 0 ? (
                  <div
                    style={{
                      position: "absolute", top: "calc(var(--u)*.4)", right: "calc(var(--u)*.4)", display: "flex",
                      alignItems: "center", gap: "calc(var(--u)*.2)", padding: "calc(var(--u)*.16) calc(var(--u)*.45)",
                      borderRadius: "999px", background: "rgba(20,14,6,.82)", color: "var(--ink-amber-highlight)",
                      fontFamily: "var(--font-display)", fontSize: "calc(var(--u)*.8)", lineHeight: 1.2,
                    }}
                  >
                    <User weight="fill" size="1em" style={{ fontSize: "calc(var(--u)*.78)" }} />
                    {votes}
                  </div>
                ) : null}
                <div style={{ padding: "calc(var(--u)*.45) calc(var(--u)*.6) calc(var(--u)*.6)" }}>
                  <b style={{ display: "block", fontFamily: "var(--font-display)", fontSize: "calc(var(--u)*.92)", lineHeight: 1.1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {g.name}
                  </b>
                  <span style={{ display: "block", marginTop: 2, fontSize: "calc(var(--u)*.74)", fontWeight: 600, color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {tileMeta(g)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Player rail */}
      <div
        style={{
          gridArea: "rail", display: "flex", alignItems: "center", gap: "calc(var(--u)*1.4)", overflow: "hidden",
          padding: "calc(var(--u)*.7) 0 calc(var(--u)*.9)", borderTop: "1px solid rgba(242,234,217,.1)", minWidth: 0, minHeight: 0,
        }}
      >
        <div style={{ flex: "none" }}>
          <b style={{ display: "block", fontFamily: "var(--font-display)", fontSize: "calc(var(--u)*1.9)", lineHeight: 1, color: "#f7f1e2" }}>{connectedCount}</b>
          <span style={{ display: "block", fontSize: "calc(var(--u)*.72)", letterSpacing: "0.2em", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>
            at the table
          </span>
        </div>
        {players.length === 0 ? (
          <span style={{ flex: 1, minWidth: 0, fontSize: "calc(var(--u)*.82)", fontWeight: 600, color: "var(--text-muted)" }}>
            Scan the QR to join. Seats fill in as players connect.
          </span>
        ) : (
        <div style={{ display: "flex", gap: "calc(var(--u)*.85)", overflow: "hidden", flex: 1, minWidth: 0 }}>
          {players.map((p) => (
            <div key={p.id} style={{ flex: "none", width: "calc(var(--u)*3)", textAlign: "center", opacity: p.connected ? 1 : 0.32 }}>
              <div style={{ width: "calc(var(--u)*1.9)", margin: "0 auto" }}>
                <Avatar size={32} colorHex={colorHex(p.colorId)} avatarId={p.avatarId} surface={2} />
              </div>
              <span
                style={{
                  display: "block", marginTop: "calc(var(--u)*.2)", fontSize: "calc(var(--u)*.76)", fontWeight: 600,
                  color: "rgba(242,234,217,.75)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}
              >
                {p.name}
              </span>
              {p.id === hostId ? (
                <span style={{ display: "block", fontSize: "calc(var(--u)*.6)", fontWeight: 700, letterSpacing: "0.1em", color: "var(--accent)" }}>
                  HOST
                </span>
              ) : null}
            </div>
          ))}
        </div>
        )}
      </div>
    </div>
  );
}
