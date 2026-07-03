import type { Identity } from "@hubbub/protocol";
export type { Identity };

const KEY = "hubbub:identity";

// Offline-safe: hex strings + system unicode emoji. Never CDN-loaded.
export const PALETTE = ["#e6194B", "#3cb44b", "#ffe119", "#4363d8", "#f58231", "#911eb4", "#42d4f4", "#f032e6"];
export const EMOJIS = ["😀", "😎", "🐱", "🐶", "🦊", "🐼", "🐸", "🐵", "🦄", "🐙", "🍕", "🍔", "🚀", "⚡", "🌟", "🎮"];

export function loadIdentity(): Identity | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (typeof v?.name === "string" && typeof v?.color === "string" && typeof v?.emoji === "string") return v;
    return null;
  } catch { return null; }
}

export function saveIdentity(id: Identity): void {
  localStorage.setItem(KEY, JSON.stringify(id));
}
