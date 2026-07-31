import type { GameSummary, Player, Suggestion } from "@hubbub/protocol";
import { Avatar, GlowButton, KeyArt, SuggestionBadge, colorHex } from "@hubbub/ui";

function playerCountLabel(g: GameSummary): string {
  if (g.maxPlayers === undefined) return `${g.minPlayers}+ players`;
  if (g.maxPlayers === g.minPlayers) return `${g.minPlayers} players`;
  return `${g.minPlayers}-${g.maxPlayers} players`;
}

function tileMeta(g: GameSummary): string {
  const range = g.maxPlayers && g.maxPlayers !== g.minPlayers ? `${g.minPlayers}-${g.maxPlayers}` : `${g.minPlayers}+`;
  return g.category ? `${g.category} · ${range}` : range;
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
  const categories = Array.from(new Set(games.map((g) => g.category).filter((c): c is string => !!c)));
  const dense = players.length > 16;
  const avatarSize = dense ? 44 : 56;

  return (
    <div style={{ width: 1920, height: 1080, display: "flex", flexDirection: "column", color: "var(--text-primary)" }}>
      <style>{`@keyframes hb-player-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>

      {/* Header */}
      <div
        style={{
          height: 56, flex: "none", padding: "0 48px",
          borderBottom: "1px solid var(--divider)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}
      >
        <div style={{ font: "700 34px var(--font-display)", letterSpacing: "0.03em" }}>HUBBUB</div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ font: "400 22px var(--font-ui)", color: "var(--text-muted)" }}>{controllerLabel} · room</span>
          <span style={{ font: "700 40px var(--font-display)", letterSpacing: "0.08em" }}>{code || "…"}</span>
          {qr ? (
            <div style={{ width: 40, height: 40, padding: 4, borderRadius: 4, background: "var(--text-primary)" }}>
              <img src={qr} alt="Join QR" width={32} height={32} style={{ display: "block" }} />
            </div>
          ) : null}
        </div>
      </div>

      {/* Hero */}
      <div
        style={{
          flex: 1, margin: "24px 48px 0", borderRadius: "var(--radius-lg)",
          background: "var(--surface-1)", border: "1px solid var(--divider-heavy)",
          overflow: "hidden", position: "relative",
        }}
      >
        {focused ? (
          <>
            <KeyArt
              pairHexes={focused.identityColors ? [colorHex(focused.identityColors[0]), colorHex(focused.identityColors[1])] : [colorHex(1), colorHex(0)]}
              title={focused.name}
              style={{ position: "absolute", inset: "0 0 0 640px" }}
            />
            <div
              style={{
                position: "absolute", inset: 0, pointerEvents: "none",
                background: "linear-gradient(to right, #1D1F2E 0, #1D1F2E 240px, rgba(29,31,46,0) 560px)",
              }}
            />
            <div
              style={{
                position: "relative", zIndex: 2, width: 880, height: "100%", padding: 48,
                display: "flex", flexDirection: "column", justifyContent: "space-between",
              }}
            >
              {focused.category ? (
                <span
                  style={{
                    alignSelf: "flex-start", font: "500 22px var(--font-ui)", letterSpacing: "0.10em",
                    color: "var(--text-muted)", border: "1px solid rgba(233,233,237,.18)",
                    borderRadius: "var(--radius-pill)", padding: "6px 18px",
                  }}
                >
                  {focused.category.toUpperCase()}
                </span>
              ) : <span />}
              <div style={{ font: "600 100px var(--font-ui)", lineHeight: 0.98, letterSpacing: "-0.03em" }}>{focused.name}</div>
              <div style={{ display: "flex", gap: 24, font: "500 26px var(--font-ui)", color: "var(--text-muted)" }}>
                <span>{playerCountLabel(focused)}</span>
                {focused.category ? <span>{focused.category}</span> : null}
              </div>
              <GlowButton colorHex={colorHex(1)} height={80} label="Start game" fullWidth={false} />
            </div>
          </>
        ) : null}
      </div>

      {/* Category row — only when the catalog spans more than one category */}
      {categories.length > 1 ? (
        <div style={{ flex: "none", padding: "24px 48px 0", display: "flex", alignItems: "center", gap: 12 }}>
          <span
            style={{
              font: "400 26px var(--font-ui)", padding: "8px 24px", borderRadius: "var(--radius-md)",
              background: "rgba(145,132,217,.16)", border: "1px solid var(--accent)", color: "var(--text-primary)",
            }}
          >
            All
          </span>
          {categories.map((c) => (
            <span
              key={c}
              style={{
                font: "400 26px var(--font-ui)", padding: "8px 24px", borderRadius: "var(--radius-md)",
                background: "var(--surface-1)", border: "1px solid var(--divider)", color: "var(--text-secondary)",
              }}
            >
              {c}
            </span>
          ))}
          {games.length > 20 ? (
            <span style={{ marginLeft: "auto", font: "400 24px var(--font-ui)", color: "var(--text-faint)" }}>
              ▸ page for {games.length - 20} more
            </span>
          ) : null}
        </div>
      ) : null}

      {/* Catalog grid */}
      <div style={{ flex: "none", padding: "16px 48px 0", display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 16 }}>
        {games.map((g, i) => {
          const isFocused = i === cursorIndex;
          const suggesters = suggestersOf(g.id);
          return (
            <div
              key={g.id}
              style={{
                position: "relative", height: 212, borderRadius: "var(--radius-md)", overflow: "hidden",
                display: "flex", flexDirection: "column",
                background: isFocused
                  ? "linear-gradient(rgba(233,233,237,.04), rgba(233,233,237,.04)), var(--surface-1)"
                  : "var(--surface-1)",
                border: isFocused ? "1px solid rgba(233,233,237,.20)" : "1px solid var(--divider)",
              }}
            >
              <KeyArt
                pairHexes={g.identityColors ? [colorHex(g.identityColors[0]), colorHex(g.identityColors[1])] : [colorHex(1), colorHex(0)]}
                title={g.name}
                style={{ height: 120, flex: "none" }}
              />
              {suggesters.length > 0 ? (
                <div style={{ position: "absolute", top: 8, left: 8 }}>
                  <SuggestionBadge emoji={suggesters[0].emoji} label="ROOM PICK" count={suggesters.length} />
                </div>
              ) : null}
              <div style={{ padding: "12px 16px" }}>
                <div style={{ font: "600 28px var(--font-ui)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{g.name}</div>
                <div style={{ font: "400 22px var(--font-ui)", color: "var(--text-muted)" }}>{tileMeta(g)}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Player rail */}
      <div
        style={{
          flex: "none", minHeight: 132, marginTop: 24, background: "var(--surface-1)",
          borderTop: "1px solid var(--divider-heavy)", padding: "0 48px",
          display: "flex", alignItems: "center", gap: 32, flexWrap: "wrap",
        }}
      >
        <div style={{ flex: "none", display: "flex", flexDirection: "column", gap: 4, padding: "16px 0" }}>
          <span style={{ font: "600 30px var(--font-ui)" }}>{connectedCount} connected</span>
          <span style={{ font: "500 20px var(--font-ui)", letterSpacing: "0.10em", color: "var(--text-faint)" }}>
            JOIN ANYTIME · {code || "…"}
          </span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: dense ? 8 : 20, padding: "16px 0" }}>
          {players.map((p) => (
            <div
              key={p.id}
              style={{
                width: 88, display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                animation: "hb-player-in 200ms ease-out",
              }}
            >
              <Avatar size={avatarSize} colorHex={colorHex(p.colorId)} emoji={p.emoji} surface={2} disconnected={!p.connected} host={p.id === hostId} />
              <span
                style={{
                  font: `500 ${dense ? 20 : 22}px var(--font-ui)`, color: "var(--text-secondary)",
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 88,
                }}
              >
                {p.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
