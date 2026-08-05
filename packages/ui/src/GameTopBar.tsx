import type { ReactNode } from "react";
import { Avatar, NEUTRAL_RING } from "./Avatar";

export type GameTopBarPlayer = {
  name: string;
  colorHex: string;
  emoji: string;
  host?: boolean;
  connected?: boolean;
};

export type GameTopBarProps = {
  /** Game wordmark, e.g. "Music Guesser". */
  title: string;
  roomCode: string;
  /** Fallback center content when `players` isn't supplied. */
  children?: ReactNode;
  /** Renders the avatar-with-name-under fixed-width columns from a6-game-tv.html. */
  players?: GameTopBarPlayer[];
};

/** Platform chrome for in-game TV screens (a6-game-tv.html). Fluid, sized off --u. */
export function GameTopBar({ title, roomCode, children, players }: GameTopBarProps) {
  return (
    <div
      style={{
        flex: "none",
        display: "grid",
        gridTemplateColumns: "auto minmax(0,1fr) auto",
        alignItems: "center",
        gap: "calc(var(--u)*1.2)",
        padding: "calc(var(--u)*.38) calc(var(--u)*1.4)",
        background: "linear-gradient(180deg,#241d15,#161109)",
        borderBottom: "calc(var(--u)*.12) solid var(--accent)",
        minWidth: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "calc(var(--u)*.8)", minWidth: 0 }}>
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "calc(var(--u)*1.3)",
            lineHeight: 0.9,
            letterSpacing: "-0.02em",
            color: "#f7f1e2",
            flex: "none",
          }}
        >
          HUB<span style={{ color: "var(--accent)" }}>BUB</span>
        </div>
        <div style={{ width: 1, height: "calc(var(--u)*1.5)", background: "var(--divider-heavy)", flex: "none" }} />
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "calc(var(--u)*1.05)",
            lineHeight: 1,
            color: "rgba(242,234,217,.78)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {title}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "flex-end",
          gap: "calc(var(--u)*.6)",
          minWidth: 0,
          overflow: "hidden",
        }}
      >
        {players
          ? players.map((p, i) => (
              <div
                key={i}
                style={{
                  flex: "none",
                  width: "calc(var(--u)*3.5)",
                  textAlign: "center",
                  opacity: p.connected === false ? 0.3 : 1,
                }}
              >
                <div style={{ width: "calc(var(--u)*1.5)", margin: "0 auto" }}>
                  <Avatar size={28} colorHex={NEUTRAL_RING} emoji={p.emoji} surface={2} />
                </div>
                <span
                  style={{
                    display: "block",
                    marginTop: "calc(var(--u)*.12)",
                    fontSize: "calc(var(--u)*.72)",
                    fontWeight: 600,
                    color: "rgba(242,234,217,.78)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {p.name}
                </span>
                {p.host ? (
                  <b
                    style={{
                      display: "block",
                      fontSize: "calc(var(--u)*.54)",
                      fontWeight: 700,
                      letterSpacing: "0.12em",
                      color: "var(--accent)",
                      lineHeight: 1.3,
                    }}
                  >
                    HOST
                  </b>
                ) : null}
              </div>
            ))
          : children}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          flex: "none",
          paddingLeft: "calc(var(--u)*1)",
          borderLeft: "1px solid var(--divider-heavy)",
        }}
      >
        <div
          style={{
            textAlign: "center",
            padding: "calc(var(--u)*.2) calc(var(--u)*.7) calc(var(--u)*.32)",
            borderRadius: "calc(var(--u)*.28)",
            background: "linear-gradient(180deg,var(--kraft-light),var(--kraft-dark))",
            boxShadow: "0 2px 0 #7d6242, inset 0 1px 0 rgba(255,255,255,.4)",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "calc(var(--u)*1.3)",
              lineHeight: 1,
              letterSpacing: "0.08em",
              color: "var(--kraft-ink)",
            }}
          >
            {roomCode}
          </div>
          <div
            style={{
              fontSize: "calc(var(--u)*.56)",
              fontWeight: 700,
              letterSpacing: "0.1em",
              color: "var(--kraft-ink-mid)",
            }}
          >
            HUBBUB.TV
          </div>
        </div>
      </div>
    </div>
  );
}
