import type { CSSProperties } from "react";
import { GlowButton } from "@hubbub/ui";

/** First-run phone screen: pick guest or Google before the avatar picker.
 * Google is a visual placeholder only - no auth, no dependency, no network call. */
export function WelcomeScreen({ onContinue }: { onContinue: () => void }) {
  return (
    <main style={page}>
      <div style={mark}>
        <BurstMark />
        <div style={wordmark}>
          HUB<span style={{ color: "var(--accent)" }}>BUB</span>
        </div>
      </div>

      <div style={greeting}>
        <h1 style={heading}>Let&rsquo;s get you in</h1>
        <p style={subcopy}>Pick how you&rsquo;d like to show up. You can always add an account later.</p>
      </div>

      <div style={actions}>
        <GlowButton height={58} label="Continue as guest" onClick={onContinue} />
        <button type="button" onClick={onContinue} style={googleButton}>
          <GoogleMark />
          Continue with Google
        </button>
      </div>

      <p style={fine}>Guest keeps your name and avatar on this device only.</p>
    </main>
  );
}

// Product wordmark mark, not a generic UI glyph - kept as inline art like the Google
// logo below, rather than approximated with a generic icon-set glyph.
function BurstMark() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" style={{ color: "var(--accent)" }} aria-hidden="true">
      <circle cx="20" cy="20" r="4.5" fill="currentColor" />
      <g stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
        <line x1="20" y1="4" x2="20" y2="11" />
        <line x1="20" y1="29" x2="20" y2="36" />
        <line x1="4" y1="20" x2="11" y2="20" />
        <line x1="29" y1="20" x2="36" y2="20" />
        <line x1="8.5" y1="8.5" x2="13.5" y2="13.5" />
        <line x1="26.5" y1="26.5" x2="31.5" y2="31.5" />
        <line x1="31.5" y1="8.5" x2="26.5" y2="13.5" />
        <line x1="13.5" y1="26.5" x2="8.5" y2="31.5" />
      </g>
    </svg>
  );
}

// Official Google "G" brand mark - four fixed brand colors, kept verbatim rather
// than substituted with a generic icon-set glyph.
function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.55-1.85.87-3.06.87-2.36 0-4.36-1.6-5.07-3.75H.9v2.33A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.93 10.68a5.4 5.4 0 0 1 0-3.36V5H.9a9 9 0 0 0 0 8l3.03-2.32Z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A8.9 8.9 0 0 0 9 0 9 9 0 0 0 .9 5l3.03 2.32C4.64 5.18 6.64 3.58 9 3.58Z" />
    </svg>
  );
}

const page: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  height: "100dvh",
  padding: "0 34px",
  textAlign: "center",
  gap: 44,
  background: "var(--surface-0)",
  color: "var(--text-primary)",
};
const mark: CSSProperties = { display: "flex", flexDirection: "column", alignItems: "center", gap: 14 };
const wordmark: CSSProperties = { font: "700 30px var(--font-display)", letterSpacing: "0.02em" };
const greeting: CSSProperties = { display: "flex", flexDirection: "column", gap: 10 };
const heading: CSSProperties = { margin: 0, font: "700 28px var(--font-display)", lineHeight: 1.2 };
const subcopy: CSSProperties = { margin: 0, font: "500 15px var(--font-ui)", lineHeight: 1.5, color: "var(--text-secondary)" };
const actions: CSSProperties = { width: "100%", display: "flex", flexDirection: "column", gap: 12 };
const googleButton: CSSProperties = {
  width: "100%",
  height: 58,
  borderRadius: "var(--radius-md)",
  border: "1px solid var(--divider-heavy)",
  background: "rgba(242,234,217,.03)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
  font: "600 16px var(--font-ui)",
  color: "var(--text-secondary)",
  cursor: "pointer",
};
const fine: CSSProperties = { margin: 0, font: "500 12px var(--font-ui)", lineHeight: 1.5, color: "var(--text-faint)", maxWidth: "30ch" };
