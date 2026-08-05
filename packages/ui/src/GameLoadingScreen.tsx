import { KeyArt, gameKeyArtHexes } from "./KeyArt";

export type GameLoadingScreenProps = {
  gameName: string;
  /** The game's identity hue index, same value the lobby card uses, so the art carries over. */
  identityColors?: number[];
  category?: string;
};

/** Shown while a game's chunk downloads. The key art is the only lit element: this is a
 * waiting beat, not a second lobby. */
export function GameLoadingScreen({ gameName, identityColors, category }: GameLoadingScreenProps) {
  return (
    <div
      className="hb-anim-enter"
      style={{
        flex: 1,
        minHeight: 0,
        width: "100%",
        background: "var(--surface-0)",
        color: "var(--text-primary)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "calc(var(--u)*1.6)",
        animation: "hb-fade-in 220ms ease-out 1 both",
      }}
    >
      <KeyArt
        pairHexes={gameKeyArtHexes(identityColors)}
        title={gameName}
        style={{
          width: "calc(var(--u)*17)",
          height: "calc(var(--u)*17)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "0 0 calc(var(--u)*4) rgba(0,0,0,.55)",
        }}
      />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "calc(var(--u)*.5)" }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: "calc(var(--u)*3)", lineHeight: 1.05 }}>
          {gameName}
        </div>
        {category ? (
          <div
            style={{
              fontSize: "calc(var(--u)*1.15)",
              fontWeight: 600,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "var(--text-faint)",
            }}
          >
            {category}
          </div>
        ) : null}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "calc(var(--u)*.8)" }}>
        <span
          className="hb-anim-spin"
          style={{
            width: "calc(var(--u)*1.5)",
            height: "calc(var(--u)*1.5)",
            borderRadius: "50%",
            border: "calc(var(--u)*.18) solid var(--divider-heavy)",
            borderTopColor: "var(--accent)",
            animation: "hb-spin 760ms linear infinite",
          }}
        />
        <span style={{ fontSize: "calc(var(--u)*1.3)", fontWeight: 500, color: "var(--text-secondary)" }}>
          Loading
        </span>
      </div>
    </div>
  );
}
