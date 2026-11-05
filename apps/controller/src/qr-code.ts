import { ROOM_CODE_LENGTH } from "@hubbub/protocol";

// Room codes are uppercase alphanumerics; the exact alphabet is private to protocol, and a
// look-alike that is not a real code simply fails to join, so the shape check stays loose.
const CODE_SHAPE = new RegExp(`^[A-Z0-9]{${ROOM_CODE_LENGTH}}$`);

function asCode(raw: string | null): string | null {
  const code = raw?.trim().toUpperCase() ?? "";
  return CODE_SHAPE.test(code) ? code : null;
}

/** Turns whatever a scanned QR decoded to into a room code, or null when it is not ours.
 * The big screen encodes `<controller url>/?room=CODE`; a bare code is accepted too. */
export function parseJoinCode(payload: string): string | null {
  const text = payload.trim();
  const bare = asCode(text);
  if (bare) return bare;
  try {
    return asCode(new URL(text).searchParams.get("room"));
  } catch {
    return null;
  }
}
