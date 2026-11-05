import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Sword } from "@phosphor-icons/react/dist/csr/Sword";
import { Smiley } from "@phosphor-icons/react/dist/csr/Smiley";
import { Bird } from "@phosphor-icons/react/dist/csr/Bird";
import { Image as ImageIcon } from "@phosphor-icons/react/dist/csr/Image";
import { PencilSimple } from "@phosphor-icons/react/dist/csr/PencilSimple";
import { GlowButton, NeutralButton, Avatar, AVATAR_SETS, randomAvatarId } from "@hubbub/ui";
import type { Player } from "@hubbub/protocol";
import { NEUTRAL_RING, BackHeader } from "./header";
import type { Identity } from "./identity";

// Derived from an icon rather than imported from the package root, which structural.test.ts bans.
type TabIcon = typeof Sword;

// One glyph per set that hints at its art style (fantasy line art, flat emoji, the bird
// behind Twemoji). Keyed by set id so a set added to AVATAR_SETS still renders with the fallback.
const SET_ICONS: Record<string, TabIcon> = { gi: Sword, fe: Smiley, tw: Bird };
const FALLBACK_SET_ICON: TabIcon = ImageIcon;

// Long enough to ride out typing, short enough that closing the screen right after rarely
// beats it (leaving also flushes, so a pending edit is never lost).
const NAME_SAVE_DELAY_MS = 700;

type View = "profile" | "picker";

export function Settings({
  initial,
  onSave,
  onCancel,
  roomPlayers,
  ownPlayerId,
}: {
  initial?: Identity;
  /** First-run: called once by Continue. Edit mode (`onCancel` set): called on every change, never with a blank name. */
  onSave: (id: Identity) => void;
  /** Present only when editing an existing identity; its absence means first-run, which has no way back. */
  onCancel?: () => void;
  /** Connected players in the current room, for the taken-character check. Empty pre-join. */
  roomPlayers?: Player[];
  ownPlayerId?: string;
}) {
  const firstRun = !onCancel;
  const [name, setName] = useState(initial?.name ?? "");
  const others = (roomPlayers ?? []).filter((p) => p.connected && p.id !== ownPlayerId);
  const [avatarId, setAvatarId] = useState(initial?.avatarId ?? (() => randomAvatarId(others.map((p) => p.avatarId))));
  // Colour is no longer player-facing; a fresh identity still needs one on the wire
  // for games that draw pieces by colorId, so it's picked once here and never shown.
  const [colorId] = useState(initial?.colorId ?? Math.floor(Math.random() * 6));
  const [view, setView] = useState<View>("profile");
  const [activeSetId, setActiveSetId] = useState(
    () => AVATAR_SETS.find((s) => s.characters.some((c) => c.id === avatarId))?.id ?? AVATAR_SETS[0]?.id ?? "",
  );
  const [confirmLeave, setConfirmLeave] = useState(false);

  // The last name that actually went out. A blank edit never overwrites it, so an avatar pick
  // made while the field is empty still saves with a real name.
  const savedName = useRef(initial?.name ?? "");
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  const avatarIdTaken = (e: string) => others.some((p) => p.avatarId === e);

  function persist(nextAvatarId: string) {
    const trimmed = name.trim();
    const nameToSend = trimmed !== "" ? trimmed : savedName.current;
    if (nameToSend === "") return;
    savedName.current = nameToSend;
    onSaveRef.current({ name: nameToSend, colorId, avatarId: nextAvatarId });
  }

  // Latest name/avatar for the debounce and blur paths, which outlive the render that scheduled them.
  const latest = useRef({ name, avatarId });
  latest.current = { name, avatarId };

  function flushName() {
    if (firstRun) return;
    const trimmed = latest.current.name.trim();
    if (trimmed === "" || trimmed === savedName.current) return;
    savedName.current = trimmed;
    onSaveRef.current({ name: trimmed, colorId, avatarId: latest.current.avatarId });
  }

  useEffect(() => {
    if (firstRun) return;
    const trimmed = name.trim();
    if (trimmed === "" || trimmed === savedName.current) return;
    const t = setTimeout(flushName, NAME_SAVE_DELAY_MS);
    return () => clearTimeout(t);
    // flushName reads refs, so only a name change needs to re-arm the timer.
  }, [name]);

  function pickAvatar(id: string) {
    setAvatarId(id);
    if (!firstRun) persist(id);
  }

  function requestLeave() {
    if (!onCancel) return;
    if (name.trim() === "") {
      setConfirmLeave(true);
      return;
    }
    flushName();
    onCancel();
  }

  const activeSet = AVATAR_SETS.find((s) => s.id === activeSetId) ?? AVATAR_SETS[0];

  return (
    <main style={page}>
      {view === "picker" ? (
        <BackHeader title="Pick an avatar" onBack={() => setView("profile")} />
      ) : onCancel ? (
        <BackHeader title="Your profile" onBack={requestLeave} />
      ) : (
        <div style={{ height: 44 }} />
      )}

      {view === "profile" ? (
        <>
          <div style={profileBody}>
            <button type="button" onClick={() => setView("picker")} aria-label="Change avatar" style={avatarButton}>
              <Avatar size={112} colorHex={NEUTRAL_RING} avatarId={avatarId} surface={1} />
              <span style={editBadge} aria-hidden="true">
                <PencilSimple size={16} weight="bold" />
              </span>
            </button>
            <div style={nameField}>
              <label htmlFor="hb-name" style={fieldLabel}>
                Your name
              </label>
              <input
                id="hb-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={flushName}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                }}
                placeholder="Your name"
                maxLength={24}
                style={nameInput}
              />
            </div>
          </div>
          {firstRun ? (
            <div style={footer}>
              <GlowButton
                height={56}
                label="Continue"
                disabled={name.trim() === ""}
                onClick={() => onSave({ name: name.trim(), colorId, avatarId })}
              />
            </div>
          ) : null}
        </>
      ) : (
        <>
          <div role="tablist" aria-label="Avatar sets" style={tabBar}>
            {AVATAR_SETS.map((set) => {
              const Icon = SET_ICONS[set.id] ?? FALLBACK_SET_ICON;
              const active = set.id === activeSet?.id;
              return (
                <button
                  key={set.id}
                  type="button"
                  role="tab"
                  id={`hb-tab-${set.id}`}
                  aria-selected={active}
                  aria-controls="hb-tabpanel"
                  onClick={() => setActiveSetId(set.id)}
                  style={{ ...tab, ...(active ? tabActive : null) }}
                >
                  <Icon size={18} weight={active ? "bold" : "regular"} />
                  <span>{set.name}</span>
                </button>
              );
            })}
          </div>

          {activeSet ? (
            <div role="tabpanel" id="hb-tabpanel" aria-labelledby={`hb-tab-${activeSet.id}`} style={panel}>
              <div style={avatarIdGrid}>
                {activeSet.characters.map((c) => {
                  const taken = avatarIdTaken(c.id) && c.id !== avatarId;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      disabled={taken}
                      onClick={() => pickAvatar(c.id)}
                      title={c.label}
                      style={{ ...avatarIdCell, opacity: taken ? 0.26 : 1, cursor: taken ? "default" : "pointer", borderColor: avatarId === c.id ? "var(--ink-amber-highlight)" : "transparent" }}
                    >
                      <Avatar size={40} colorHex={NEUTRAL_RING} avatarId={c.id} surface={1} />
                    </button>
                  );
                })}
              </div>
              {activeSet.characters.some((c) => avatarIdTaken(c.id)) ? (
                <div style={takenCaption}>Faded ones are taken by someone in the room.</div>
              ) : null}
              <div style={credits}>
                <span style={licenceTag}>{activeSet.licenseName}</span>
                <div style={attribLine}>{activeSet.attribution}</div>
              </div>
            </div>
          ) : null}
        </>
      )}

      {confirmLeave ? (
        <div style={overlay}>
          <div role="dialog" aria-modal="true" aria-labelledby="hb-leave-title" style={dialog}>
            <div id="hb-leave-title" style={dialogTitle}>
              A name is required
            </div>
            <div style={dialogBody}>Nothing will be saved if you leave with a blank name.</div>
            <div style={dialogRow}>
              <GlowButton height={48} label="Keep editing" onClick={() => setConfirmLeave(false)} />
              <NeutralButton height={48} label="Leave anyway" onClick={() => onCancel?.()} />
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

const page: CSSProperties = { display: "flex", flexDirection: "column", height: "100dvh", background: "var(--surface-0)", color: "var(--text-primary)" };
const profileBody: CSSProperties = { flex: 1, minHeight: 0, overflowY: "auto", padding: "32px 20px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 28 };
const avatarButton: CSSProperties = {
  position: "relative",
  flex: "none",
  padding: 0,
  background: "transparent",
  border: "none",
  borderRadius: "50%",
  cursor: "pointer",
};
const editBadge: CSSProperties = {
  position: "absolute",
  right: -2,
  bottom: -2,
  width: 32,
  height: 32,
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "var(--surface-2)",
  border: "1px solid var(--divider-heavy)",
  color: "var(--ink-amber-highlight)",
};
const nameField: CSSProperties = { width: "100%", maxWidth: 320 };
const fieldLabel: CSSProperties = { display: "block", font: "700 10.5px var(--font-ui)", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 6 };
const nameInput: CSSProperties = {
  width: "100%",
  minHeight: 48,
  padding: "10px 12px",
  borderRadius: "var(--radius-md)",
  background: "rgba(242,234,217,.07)",
  border: "1px solid var(--divider-heavy)",
  color: "var(--text-primary)",
  font: "600 16px var(--font-ui)",
};
const tabBar: CSSProperties = {
  flex: "none",
  display: "flex",
  gap: 6,
  padding: "10px 14px 0",
  overflowX: "auto",
  borderBottom: "1px solid var(--divider)",
};
const tab: CSSProperties = {
  flex: "1 0 auto",
  minHeight: 44,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 7,
  padding: "0 14px",
  background: "transparent",
  // Longhands, so the active state can swap borderBottomColor without React's shorthand-conflict warning.
  borderWidth: "0 0 2px",
  borderStyle: "solid",
  borderColor: "transparent",
  color: "var(--text-muted)",
  font: "600 13px var(--font-ui)",
  whiteSpace: "nowrap",
  cursor: "pointer",
};
const tabActive: CSSProperties = { color: "var(--ink-amber-highlight)", borderColor: "var(--ink-amber-highlight)" };
const panel: CSSProperties = { flex: 1, minHeight: 0, overflowY: "auto", padding: "16px 14px 20px", display: "flex", flexDirection: "column" };
const avatarIdGrid: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 9 };
const avatarIdCell: CSSProperties = {
  aspectRatio: "1",
  borderRadius: "var(--radius-lg)",
  background: "rgba(242,234,217,.05)",
  border: "2px solid transparent",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};
const takenCaption: CSSProperties = { marginTop: 12, textAlign: "center", font: "500 11px var(--font-ui)", color: "var(--text-muted)" };
const credits: CSSProperties = { marginTop: "auto", paddingTop: 22, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8 };
const licenceTag: CSSProperties = {
  font: "700 9px var(--font-ui)",
  letterSpacing: "0.08em",
  color: "var(--text-faint)",
  border: "1px solid var(--divider-heavy)",
  borderRadius: 4,
  padding: "2px 6px",
};
const attribLine: CSSProperties = { font: "500 10.5px var(--font-ui)", lineHeight: 1.4, color: "var(--text-faint)" };
const footer: CSSProperties = { flex: "none", padding: 14, borderTop: "1px solid var(--divider)" };
const overlay: CSSProperties = { position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, background: "rgba(0,0,0,.6)" };
const dialog: CSSProperties = {
  width: "100%",
  maxWidth: 340,
  padding: 18,
  borderRadius: "var(--radius-lg)",
  background: "var(--surface-1)",
  border: "1px solid var(--divider-heavy)",
  display: "flex",
  flexDirection: "column",
  gap: 8,
};
const dialogTitle: CSSProperties = { font: "700 17px var(--font-display)" };
const dialogBody: CSSProperties = { font: "500 13.5px var(--font-ui)", lineHeight: 1.45, color: "var(--text-secondary)", marginBottom: 10 };
// Stacked, not side by side: GlowButton's fixed 32px side padding leaves too little label width
// in a half-width slot at phone size. Both are 48 high either way.
const dialogRow: CSSProperties = { display: "flex", flexDirection: "column", gap: 8 };
