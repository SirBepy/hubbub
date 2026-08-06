import { ROOM_CODE_LENGTH } from "@hubbub/protocol";
import type { TokenSource } from "@hubbub/relay";

// @hubbub/protocol/tokens.ts is Node-only (node:crypto). workerd has no nodejs_compat flag
// enabled here, so this is a Web Crypto reimplementation - alphabet mirrored from there and
// from .claude/skills/capture/scripts/capture.cjs; keep all three in sync.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const webCryptoTokens: TokenSource = {
  next: () => crypto.randomUUID().replace(/-/g, ""),
};

export function newRoomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(ROOM_CODE_LENGTH));
  let code = "";
  for (const b of bytes) code += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return code;
}
