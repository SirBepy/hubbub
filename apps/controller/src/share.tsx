import { useEffect, useState, type CSSProperties } from "react";
import QRCode from "qrcode";
import { GlowButton, NeutralButton } from "@hubbub/ui";
import { BackHeader } from "./header";

export function ShareScreen({ code, onBack }: { code: string; onBack: () => void }) {
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState(false);
  const url = `${location.origin}/?room=${code}`;

  useEffect(() => {
    QRCode.toDataURL(url).then(setQr);
  }, [url]);

  async function copyLink() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Join my Hubbub room", url });
      } catch {
        // User cancelled the native sheet - not an error.
      }
    } else {
      copyLink();
    }
  }

  return (
    <main style={page}>
      <BackHeader title="Share the room" onBack={onBack} />
      <div style={body}>
        <div style={card}>
          <div style={qrBox}>{qr ? <img src={qr} alt="Join QR code" style={qrImg} /> : null}</div>
          <div style={codeText}>{code}</div>
          <div style={urlText}>{url.replace(/^https?:\/\//, "")}</div>
        </div>
      </div>
      <div style={footer}>
        <GlowButton height={56} label="Send to a friend" onClick={share} />
        <NeutralButton height={56} label={copied ? "Copied!" : "Copy link"} onClick={copyLink} />
      </div>
    </main>
  );
}

const page: CSSProperties = { display: "flex", flexDirection: "column", height: "100dvh", background: "var(--surface-0)", color: "var(--text-primary)" };
const body: CSSProperties = { flex: 1, minHeight: 0, padding: "14px 14px 0" };
const card: CSSProperties = {
  padding: 20,
  borderRadius: "var(--radius-lg)",
  textAlign: "center",
  background: "linear-gradient(180deg, var(--kraft-light), var(--kraft-mid) 55%, var(--kraft-dark))",
  color: "var(--kraft-ink)",
  boxShadow: "0 4px 0 #7d6242, inset 0 1px 0 rgba(255,255,255,.45)",
};
const qrBox: CSSProperties = { width: 196, height: 196, margin: "0 auto", background: "#F4EFE2", borderRadius: 8, padding: 8 };
const qrImg: CSSProperties = { display: "block", width: "100%", height: "100%" };
const codeText: CSSProperties = { marginTop: 14, font: "400 44px var(--font-display)", lineHeight: 1, letterSpacing: "0.1em" };
const urlText: CSSProperties = { marginTop: 4, font: "700 14px var(--font-ui)", color: "var(--kraft-ink-mid)" };
const footer: CSSProperties = { flex: "none", padding: "14px 14px 18px", display: "flex", flexDirection: "column", gap: 8 };
