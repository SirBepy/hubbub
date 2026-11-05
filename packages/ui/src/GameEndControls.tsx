import type { CSSProperties } from "react";
import { GlowButton, NeutralButton } from "./GlowButton";

export type GameEndControlsProps = {
  /** From usePlatform(): only the host's phone may rematch or end the match. */
  isHost: boolean;
  /** From usePlatform(): true right after Rematch is pressed, so the press visibly registered. */
  rematchPending?: boolean;
  onRematch: () => void;
  onReturnToLobby: () => void;
  /** Glow colour for Rematch; defaults to GlowButton's. */
  colorHex?: string;
};

/** The end-of-game button pair a game drops into its own result view. The platform no longer
 * draws these: each game places them where its layout wants them. A non-host sees a waiting
 * caption instead, since the relay would ignore their presses anyway. */
export function GameEndControls({ isHost, rematchPending = false, onRematch, onReturnToLobby, colorHex }: GameEndControlsProps) {
  if (!isHost) return <div style={caption}>Waiting for the host…</div>;
  return (
    <div style={row}>
      <GlowButton
        height={56}
        label={rematchPending ? "Starting…" : "Rematch"}
        fullWidth={false}
        disabled={rematchPending}
        colorHex={colorHex}
        onClick={onRematch}
      />
      <NeutralButton height={56} label="Back to lobby" fullWidth={false} onClick={onReturnToLobby} />
    </div>
  );
}

const row: CSSProperties = { display: "flex", gap: 8, justifyContent: "center" };
const caption: CSSProperties = { font: "500 13px var(--font-ui)", color: "var(--text-faint)", textAlign: "center" };
