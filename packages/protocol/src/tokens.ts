import { ROOM_CODE_LENGTH } from "./constants.js";

// Mirrored in .claude/skills/capture/scripts/capture.cjs (plain CJS, can't import raw TS); keep both in sync.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

// Web Crypto (globalThis.crypto) is available in Node 20+, browsers, and workerd, so this one
// implementation serves every runtime - no more node:crypto vs Web Crypto duplication.
export function newToken(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

// 256 % 32 === 0, so byte % alphabet.length maps each of the 256 byte values onto the 32-char
// alphabet exactly 8 times each - uniform, no modulo bias, no rejection sampling needed.
export function newRoomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(ROOM_CODE_LENGTH));
  let code = "";
  for (const b of bytes) code += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return code;
}
