import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Gear } from "@phosphor-icons/react/dist/csr/Gear";
import { SpeakerHigh } from "@phosphor-icons/react/dist/csr/SpeakerHigh";
import { SpeakerLow } from "@phosphor-icons/react/dist/csr/SpeakerLow";
import { SpeakerSlash } from "@phosphor-icons/react/dist/csr/SpeakerSlash";
import { sfx } from "@hubbub/sdk/sfx";

/** Where the volume lands when the user un-mutes from a slider they had dragged to zero. */
const RESTORED_VOLUME = 1;

/**
 * Bottom-right settings button on every TV surface. Opens a compact panel; volume is its only
 * row today, and `SettingsRow` is the seam for the next one.
 *
 * Sound unlock does not live here: TVStage installs a once-per-page gesture listener, so the
 * AudioContext resumes on the first click or key anywhere. The explicit `sfx.unlock()` calls
 * below only make sure that using this panel counts as a gesture too.
 */
export function TVSettings() {
  const [open, setOpen] = useState(false);
  const [, forceRender] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => sfx.subscribe(() => forceRender((n) => n + 1)), []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open]);

  return (
    <div ref={rootRef} style={root}>
      {open ? (
        <div id={panelId} role="dialog" aria-label="Settings" style={panel}>
          <h2 style={panelTitle}>Settings</h2>
          <VolumeRow />
        </div>
      ) : null}
      <button
        ref={buttonRef}
        type="button"
        className="hb-settings-btn"
        aria-label="Settings"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => {
          void sfx.unlock();
          setOpen((o) => !o);
        }}
        style={{ ...gearButton, color: open ? "var(--text-secondary)" : "var(--text-muted)" }}
      >
        <Gear size="calc(var(--u)*1.3)" weight="bold" />
      </button>
    </div>
  );
}

/** One labelled row of the panel: label above, its control below. */
function SettingsRow({ label, htmlFor, children }: { label: string; htmlFor?: string; children: ReactNode }) {
  return (
    <div style={row}>
      <label htmlFor={htmlFor} style={rowLabel}>
        {label}
      </label>
      {children}
    </div>
  );
}

function VolumeRow() {
  const inputId = useId();
  const muted = sfx.muted;
  const volume = sfx.volume;
  const percent = Math.round(volume * 100);
  // Dragging to zero is silent exactly like mute, so it gets the same icon without touching the
  // muted flag: the user's mute choice and their slider position stay independent.
  const silent = muted || volume === 0;
  const Icon = silent ? SpeakerSlash : volume < 0.5 ? SpeakerLow : SpeakerHigh;

  // A short existing voice at the new level, so the user hears what they set. Only on release:
  // firing it per drag step would be a machine-gun of pops.
  const blip = () => sfx.play("pop");

  return (
    <SettingsRow label="Volume" htmlFor={inputId}>
      <div style={volumeControl}>
        <button
          type="button"
          className="hb-settings-btn"
          aria-label={silent ? "Unmute" : "Mute"}
          aria-pressed={silent}
          onClick={() => {
            void sfx.unlock();
            if (silent) {
              if (volume === 0) sfx.setVolume(RESTORED_VOLUME);
              sfx.setMuted(false);
              blip();
            } else {
              sfx.setMuted(true);
            }
          }}
          style={{ ...speakerButton, color: silent ? "var(--text-muted)" : "var(--text-secondary)" }}
        >
          <Icon size="calc(var(--u)*1.4)" weight="bold" />
        </button>
        <input
          id={inputId}
          type="range"
          min={0}
          max={100}
          step={1}
          value={percent}
          aria-valuetext={muted ? "Muted" : `${percent}%`}
          onPointerDown={() => void sfx.unlock()}
          onChange={(event) => {
            void sfx.unlock();
            const next = Number(event.currentTarget.value) / 100;
            // Moving the slider is a request to hear something: leaving it muted would make the
            // control look broken.
            if (sfx.muted && next > 0) sfx.setMuted(false);
            sfx.setVolume(next);
          }}
          onPointerUp={blip}
          onKeyUp={(event) => {
            if (SLIDER_KEYS.has(event.key)) blip();
          }}
          style={{ ...slider, opacity: muted ? 0.45 : 1 }}
        />
        <span style={readout}>{muted ? "Muted" : `${percent}%`}</span>
      </div>
    </SettingsRow>
  );
}

const SLIDER_KEYS = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"]);

const root: CSSProperties = {
  position: "absolute",
  right: "calc(var(--u)*.8)",
  bottom: "calc(var(--u)*.8)",
  // Above apps/web's 9999 "Join instead" corner link, which sits directly over this button: an
  // open panel has to cover it, not share the corner with it.
  zIndex: 10000,
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-end",
  gap: "calc(var(--u)*.5)",
};

// Quiet by default: no fill, no border, muted ink. The 44px floor is the hit area, not the glyph.
const gearButton: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: 44,
  minHeight: 44,
  padding: 0,
  borderRadius: "var(--radius-pill)",
  border: "none",
  background: "transparent",
  cursor: "pointer",
};

// The negative margin pulls the glyph (not its 44px hit area) flush with the row label above.
const speakerButton: CSSProperties = { ...gearButton, flex: "none", marginLeft: "calc((var(--u)*1.4 - 44px) / 2)" };

const panel: CSSProperties = {
  width: "calc(var(--u)*19)",
  padding: "calc(var(--u)*.9) calc(var(--u)*1)",
  borderRadius: "var(--radius-lg)",
  border: "1px solid var(--divider-heavy)",
  // Near-opaque: the web app's corner link sits behind the open panel and must not ghost through.
  background: "rgba(20,14,6,.98)",
  color: "var(--text-primary)",
  fontFamily: "var(--font-ui)",
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--u)*.8)",
};

const panelTitle: CSSProperties = {
  margin: 0,
  fontSize: "calc(var(--u)*.72)",
  fontWeight: 700,
  letterSpacing: "0.22em",
  textTransform: "uppercase",
  color: "var(--text-muted)",
};

const row: CSSProperties = { display: "flex", flexDirection: "column", gap: "calc(var(--u)*.2)" };

const rowLabel: CSSProperties = {
  fontSize: "calc(var(--u)*.86)",
  fontWeight: 600,
  color: "var(--text-secondary)",
};

const volumeControl: CSSProperties = { display: "flex", alignItems: "center", gap: "calc(var(--u)*.3)" };

// Native range with the product accent: the platform draws the track, thumb and arrow-key
// behaviour, so there is no custom slider to keep accessible.
const slider: CSSProperties = {
  flex: 1,
  minWidth: 0,
  height: 28,
  margin: 0,
  accentColor: "var(--accent)",
  cursor: "pointer",
};

const readout: CSSProperties = {
  flex: "none",
  minWidth: "calc(var(--u)*2.6)",
  textAlign: "right",
  fontSize: "calc(var(--u)*.82)",
  fontWeight: 600,
  fontVariantNumeric: "tabular-nums",
  color: "var(--text-secondary)",
};
