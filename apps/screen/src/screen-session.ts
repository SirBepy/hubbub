// Pure functions over an injected Storage (mirrors config-resolve.ts's DI style) so they're
// testable without jsdom. App.tsx wires the real `sessionStorage` in.
const KEY = "hubbub:screen";

export interface ScreenSession {
  code: string;
  token: string;
}

export function loadScreenSession(storage: Storage): ScreenSession | null {
  const raw = storage.getItem(KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed?.code === "string" && typeof parsed?.token === "string") return parsed;
  } catch {
    // Corrupt value - treat exactly like "no session", never throw into the render path.
  }
  return null;
}

export function saveScreenSession(storage: Storage, session: ScreenSession): void {
  storage.setItem(KEY, JSON.stringify(session));
}

export function clearScreenSession(storage: Storage): void {
  storage.removeItem(KEY);
}
