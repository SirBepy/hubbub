import { useEffect, useRef, useState } from "react";
import { SpeakerHigh, SpeakerSlash } from "@phosphor-icons/react";
import { sfx } from "@hubbub/sdk/sfx";

/**
 * Bottom-right pill on every TV surface. Chrome's autoplay policy holds the AudioContext
 * suspended until a real user gesture on the page, so this control doubles as the unlock: a
 * click both toggles mute and calls sfx.unlock(). Icon-only once unlocked, so the steady state
 * is one small, undecorated target rather than a persistent label competing with the felt.
 */
export function SoundToggle() {
  const [, forceRender] = useState(0);
  // labelMounted controls layout (removes the label's own box from the DOM, so the pill's
  // padding only ever snaps, never transitions - width/padding are layout properties, kept out
  // of the animated path). labelFadingOut drives the opacity/transform fade that happens first.
  const [labelMounted, setLabelMounted] = useState(true);
  const [labelFadingOut, setLabelFadingOut] = useState(false);
  const fadeTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => sfx.subscribe(() => forceRender((n) => n + 1)), []);

  const unlocked = sfx.unlocked;
  useEffect(() => {
    if (unlocked) {
      // Held a beat after unlock so the label reads as confirmation rather than a flicker.
      fadeTimer.current = setTimeout(() => setLabelFadingOut(true), 600);
      return () => clearTimeout(fadeTimer.current);
    }
    setLabelFadingOut(false);
    setLabelMounted(true);
  }, [unlocked]);

  const muted = sfx.muted;
  const labelVisible = labelMounted && !muted;

  return (
    <button
      type="button"
      aria-pressed={!muted}
      aria-label={muted ? "Unmute sound" : "Mute sound"}
      onClick={() => {
        void sfx.unlock();
        sfx.setMuted(!muted);
      }}
      style={{
        position: "absolute",
        right: "calc(var(--u)*.8)",
        bottom: "calc(var(--u)*.8)",
        zIndex: 3,
        display: "flex",
        alignItems: "center",
        gap: labelVisible ? "calc(var(--u)*.4)" : 0,
        minWidth: 44,
        minHeight: 44,
        padding: labelVisible ? "0 calc(var(--u)*.9)" : 0,
        borderRadius: "var(--radius-pill)",
        border: "1px solid var(--divider-heavy)",
        background: "rgba(20,14,6,.72)",
        color: "var(--text-secondary)",
        // A button never inherits the page face; without this the label sets in Arial.
        font: "inherit",
        cursor: "pointer",
      }}
    >
      {muted ? (
        <SpeakerSlash size="calc(var(--u)*1.3)" weight="bold" />
      ) : (
        <SpeakerHigh size="calc(var(--u)*1.3)" weight="bold" />
      )}
      {labelVisible ? (
        <span
          onTransitionEnd={() => {
            if (labelFadingOut) setLabelMounted(false);
          }}
          style={{
            fontSize: "calc(var(--u)*.72)",
            fontWeight: 600,
            whiteSpace: "nowrap",
            opacity: labelFadingOut ? 0 : 1,
            transform: labelFadingOut ? "translateX(-4px)" : "none",
            transition: "opacity 200ms ease-out, transform 200ms ease-out",
          }}
        >
          Click for sound
        </span>
      ) : null}
    </button>
  );
}
