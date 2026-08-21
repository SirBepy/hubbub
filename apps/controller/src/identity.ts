import type { Identity } from "@hubbub/protocol";
export type { Identity };

const KEY = "hubbub:identity";

export function loadIdentity(): Identity | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    // Older saved identities carried a hex `color` string, not a numeric colorId - treat as no identity.
    if (typeof v?.name === "string" && Number.isInteger(v?.colorId) && v.colorId >= 0 && v.colorId <= 5 && typeof v?.avatarId === "string") return v;
    return null;
  } catch { return null; }
}

export function saveIdentity(id: Identity): void {
  localStorage.setItem(KEY, JSON.stringify(id));
}
