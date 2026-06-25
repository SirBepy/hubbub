import { useState, type CSSProperties } from "react";
import { PALETTE, EMOJIS, type Identity } from "./identity";

export function Settings({ initial, onSave, onCancel }: { initial?: Identity; onSave: (id: Identity) => void; onCancel?: () => void; }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [color, setColor] = useState(initial?.color ?? PALETTE[0]);
  const [emoji, setEmoji] = useState(initial?.emoji ?? EMOJIS[0]);

  return (
    <main style={ui}>
      <h1>You</h1>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" maxLength={24} style={input} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
        {PALETTE.map((c) => (
          <button key={c} onClick={() => setColor(c)} aria-label={c}
            style={{ width: 36, height: 36, borderRadius: "50%", background: c, border: c === color ? "3px solid #222" : "2px solid #ccc" }} />
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 6 }}>
        {EMOJIS.map((e) => (
          <button key={e} onClick={() => setEmoji(e)} style={{ fontSize: 22, padding: 4, border: e === emoji ? "3px solid #222" : "2px solid #eee", borderRadius: 8 }}>{e}</button>
        ))}
      </div>
      <button disabled={name.trim() === ""} onClick={() => onSave({ name: name.trim(), color, emoji })} style={button}>Save</button>
      {onCancel && <button onClick={onCancel} style={{ ...button, background: "#eee" }}>Cancel</button>}
    </main>
  );
}

const ui: CSSProperties = { fontFamily: "system-ui", display: "flex", flexDirection: "column", gap: 16, padding: 24, maxWidth: 360, margin: "0 auto", textAlign: "center" };
const input: CSSProperties = { fontSize: 24, padding: 12, textAlign: "center" };
const button: CSSProperties = { fontSize: 20, padding: 12 };
