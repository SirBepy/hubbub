// Room code length: 32^6 ~= 1.07 billion combinations on CODE_ALPHABET (tokens.ts), vs
// 32^4 ~= 1.05 million at the old length. Its own file (not tokens.ts) because tokens.ts is
// server-only (node:crypto) while messages.ts's wire validators need this browser-side too.
export const ROOM_CODE_LENGTH = 4;

// Cloudflare's public STUN needs no auth and matches where we already host; override per deploy.
// No TURN server - the WebSocket relay is the deliberate fallback (see transport design).
export const DEFAULT_STUN_URL = "stun:stun.cloudflare.com:3478";
