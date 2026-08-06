export type Role = "screen" | "controller";

const OVERRIDE_KEY = "hubbub:role-override";

export function getRoomCodeFromSearch(search: string): string {
  return new URLSearchParams(search).get("room") ?? "";
}

// sessionStorage, not localStorage: a device should revert to its natural role
// heuristic on a later visit rather than being stuck in whatever it was switched to.
export function getStoredRoleOverride(): Role | null {
  const v = sessionStorage.getItem(OVERRIDE_KEY);
  return v === "screen" || v === "controller" ? v : null;
}

export function setStoredRoleOverride(role: Role): void {
  sessionStorage.setItem(OVERRIDE_KEY, role);
}

// Coarse pointer + narrow viewport preselects controller; a room code or a stored
// override always wins first, so this heuristic never overrides a user's own choice.
export function decideInitialRole(opts: {
  roomCode: string;
  storedOverride: Role | null;
  coarsePointer: boolean;
  viewportWidth: number;
}): Role {
  if (opts.roomCode) return "controller";
  if (opts.storedOverride) return opts.storedOverride;
  return opts.coarsePointer && opts.viewportWidth < 768 ? "controller" : "screen";
}
