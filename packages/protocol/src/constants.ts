// Room code length: 32^6 ~= 1.07 billion combinations on CODE_ALPHABET (tokens.ts), vs
// 32^4 ~= 1.05 million at the old length. Its own file (not tokens.ts) because tokens.ts is
// server-only (node:crypto) while messages.ts's wire validators need this browser-side too.
export const ROOM_CODE_LENGTH = 4;
