import { useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { SignOut } from "@phosphor-icons/react/dist/csr/SignOut";
import { GlowButton, NeutralButton } from "@hubbub/ui";

/** Platform-owned way out of a match, pinned top-right of the in-game header. Leaving ends the
 * match for the whole room, so it asks first. Rematch and every other game action are the game's
 * own buttons (usePlatform), never drawn here. */
export function ExitGameButton({ onExit }: { onExit: () => void }) {
  const [asking, setAsking] = useState(false);
  return (
    <>
      <button type="button" aria-label="Exit game" onClick={() => setAsking(true)} style={iconButton}>
        <SignOut size={18} weight="bold" />
      </button>
      {/* Portaled to body: the header it sits in carries an entrance animation, and a transformed
          ancestor becomes the containing block of `position: fixed`, which clipped this dialog to
          the header's 58px strip. */}
      {asking ? createPortal(
        <div role="dialog" aria-modal="true" aria-label="Exit game" style={backdrop} onClick={() => setAsking(false)}>
          <div style={card} onClick={(e) => e.stopPropagation()}>
            <div style={title}>Exit the game?</div>
            <div style={body}>Are you sure you want to exit the game? It ends for everyone and the room returns to the lobby.</div>
            <div style={row}>
              <NeutralButton height={48} label="Stay" fullWidth onClick={() => setAsking(false)} />
              <GlowButton
                height={48}
                label="Exit"
                fullWidth
                onClick={() => {
                  setAsking(false);
                  onExit();
                }}
              />
            </div>
          </div>
        </div>,
        document.body,
      ) : null}
    </>
  );
}

const iconButton: CSSProperties = {
  flex: "none",
  width: 34,
  height: 34,
  borderRadius: 9,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(242,234,217,.06)",
  border: "1px solid var(--divider-heavy)",
  color: "rgba(242,234,217,.72)",
  cursor: "pointer",
};
const backdrop: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 50,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
  background: "rgba(0,0,0,.6)",
};
const card: CSSProperties = {
  width: "100%",
  maxWidth: 340,
  display: "flex",
  flexDirection: "column",
  gap: 12,
  padding: 20,
  borderRadius: 14,
  background: "var(--surface-1, #1b150e)",
  border: "1px solid var(--divider-heavy)",
};
const title: CSSProperties = { font: "700 18px var(--font-display)", color: "var(--text-primary)" };
const body: CSSProperties = { font: "500 14px var(--font-ui)", color: "var(--text-muted)", lineHeight: 1.4 };
const row: CSSProperties = { display: "flex", gap: 10, marginTop: 4 };
