// 4 chars over CODE_ALPHABET (tokens.ts) is ~1.05M codes; rate limiting, not length, defends
// the join path. Lives here, not in tokens.ts, so messages.ts's validators can import it alone.
export const ROOM_CODE_LENGTH = 4;

// Cloudflare's public STUN needs no auth and matches where we already host; override per deploy.
// No TURN server - the WebSocket relay is the deliberate fallback (see transport design).
export const DEFAULT_STUN_URL = "stun:stun.cloudflare.com:3478";
