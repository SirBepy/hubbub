import { useState, type CSSProperties } from "react";
import { randomSlogan } from "./slogans";

// Empty-room hero, swapped for Lobby the instant someone joins. Every fluid size is
// min(Nvh, capPx) with capPx its 1080p value, so nothing grows past 1080p on a bigger screen.
export function Hero({ code, qr, error }: { code: string; qr: string; error?: string }) {
  const [slogan] = useState(randomSlogan);

  return (
    <div style={{ position: "relative", flex: 1, minHeight: 0, display: "flex" }}>
      <div style={heroGlow} />
      <div style={cluster}>
        <p style={wordmark}>
          HUB<span style={{ color: "var(--accent)" }}>BUB</span>
        </p>
        <p style={sloganStyle}>{slogan}</p>
        <div style={kraftCard} data-measure="kraft-card">
          <div style={qrBox}>{qr ? <img src={qr} alt="Join QR" style={qrImg} /> : null}</div>
          <div style={kraftText}>
            <p style={joinLabel}>{error ? "Can't connect" : "Join anytime"}</p>
            <p style={roomCode} data-measure="room-code">{error ? "Offline" : code || "…"}</p>
            <p style={joinHint}>{error ?? "Scan or type the code"}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

const heroGlow: CSSProperties = {
  position: "absolute", width: "min(78vh,1500px)", height: "min(78vh,1500px)", left: "50%", top: "50%",
  transform: "translate(-50%,-50%)", pointerEvents: "none", zIndex: 0, borderRadius: "50%",
  background: "radial-gradient(circle, color-mix(in srgb, var(--accent) 15%, transparent) 0%, color-mix(in srgb, var(--accent) 5%, transparent) 42%, transparent 70%)",
};

const cluster: CSSProperties = {
  position: "relative", zIndex: 1, margin: "auto", display: "flex", flexDirection: "column",
  alignItems: "center", gap: "min(4.63vh,50px)", padding: "0 5vw",
};

const wordmark: CSSProperties = {
  margin: 0, fontFamily: "var(--font-display)", fontSize: "min(12.04vh,130px)", lineHeight: 0.88,
  letterSpacing: "-0.02em", color: "#f7f1e2",
  textShadow: "0 2px 0 #6b5a37, 0 3px 0 rgba(0,0,0,.55), 0 10px 26px rgba(0,0,0,.5)",
};

const sloganStyle: CSSProperties = {
  margin: 0, fontFamily: "var(--font-ui)", fontWeight: 600, fontSize: "min(3.15vh,34px)",
  letterSpacing: "0.01em", color: "var(--text-secondary)", textAlign: "center",
};

const kraftCard: CSSProperties = {
  display: "flex", alignItems: "stretch", gap: "min(3.7vh,40px)",
  padding: "min(2.22vh,24px) min(3.7vh,40px)", maxHeight: 302, borderRadius: 20,
  background: "linear-gradient(180deg,var(--kraft-light),var(--kraft-mid) 55%,var(--kraft-dark))",
  boxShadow: "0 4px 0 #7d6242, 0 20px 40px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.45)",
};

const qrBox: CSSProperties = {
  flex: "none", width: "min(21.3vh,230px)", height: "min(21.3vh,230px)",
  background: "#f4efe2", borderRadius: 10, padding: 10,
};

const qrImg: CSSProperties = { display: "block", width: "100%", height: "100%" };

const kraftText: CSSProperties = { display: "flex", flexDirection: "column", justifyContent: "center", gap: "min(0.74vh,8px)" };

const joinLabel: CSSProperties = {
  margin: 0, fontFamily: "var(--font-ui)", fontWeight: 800, fontSize: "min(1.48vh,16px)",
  letterSpacing: "0.26em", textTransform: "uppercase", color: "var(--kraft-ink-mid)",
};

const roomCode: CSSProperties = {
  margin: 0, fontFamily: "var(--font-display)", fontSize: "min(17.96vh,194px)", lineHeight: 1,
  letterSpacing: "0.04em", color: "var(--kraft-ink)",
};

const joinHint: CSSProperties = {
  margin: 0, fontFamily: "var(--font-ui)", fontWeight: 600, fontSize: "min(1.67vh,18px)", color: "var(--kraft-ink-mid)",
};
