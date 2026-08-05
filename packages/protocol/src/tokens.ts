import { randomUUID, randomInt } from "node:crypto";

// Mirrored in .claude/skills/capture/scripts/capture.cjs (plain CJS, can't import raw TS); keep both in sync.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function newToken(): string {
  return randomUUID().replace(/-/g, "");
}

export function newRoomCode(): string {
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return code;
}
