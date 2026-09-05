import type { CSSProperties } from "react";
import { KeyArt, gameKeyArtHexes } from "./KeyArt";

const PAGE: CSSProperties = {
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
};

const HEADLINE: CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: "calc(var(--u)*2.6)",
  lineHeight: 1.05,
  textAlign: "center",
};

const SUBLINE: CSSProperties = {
  fontSize: "calc(var(--u)*1.3)",
  fontWeight: 500,
  color: "var(--text-secondary)",
  textAlign: "center",
};

export type GameFailedScreenProps = {
  /** Same hue the lobby card and the loading beat used, so the room sees one continuous object. */
  identityColors?: number[];
  /** Title only feeds the key art's initial; it is never printed. */
  gameName: string;
};

/** Shown when a sandboxed game cannot start or dies mid-round. Says nothing about which game or
 * why: the room cannot act on a diagnosis. No spinner and no entrance animation either - the room
 * has been watching an animated card with this same art, and motion reads as "it's coming". */
export function GameFailedScreen({ identityColors, gameName }: GameFailedScreenProps) {
  return (
    <div style={PAGE} role="alert">
      <KeyArt
        pairHexes={gameKeyArtHexes(identityColors)}
        title={gameName}
        style={{
          width: "calc(var(--u)*17)",
          height: "calc(var(--u)*17)",
          borderRadius: "var(--radius-lg)",
          filter: "grayscale(.7) brightness(.55)",
        }}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: "calc(var(--u)*.55)" }}>
        <div style={HEADLINE}>This game hit a problem</div>
        <div style={SUBLINE}>Back to the lobby&hellip;</div>
      </div>
    </div>
  );
}

/** The sandbox origin collapsed onto the shell's own origin, so no game can run here. Carries no
 * game identity at all: naming one blames a game for an operator's deployment, and returning to
 * the lobby would only let the room pick another game that fails identically. */
export function SandboxUnavailableScreen({ detail }: { detail?: string }) {
  return (
    <div style={PAGE} role="alert">
      <div style={HEADLINE}>Games can&rsquo;t run on this setup</div>
      <div style={{ ...SUBLINE, maxWidth: "calc(var(--u)*34)" }}>
        {detail ?? "This Hubbub needs a separate origin to run games safely."}
      </div>
    </div>
  );
}
