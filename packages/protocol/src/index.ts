// Browser-safe surface only. Token/room-code generation lives at "@hubbub/protocol/tokens" -
// server/relay-issued only, kept out of this barrel so no client code can mint its own.
export * from "./constants.js";
export * from "./messages.js";
export * from "./transport.js";
export * from "./http.js";
// WebRTC types/classes live at "@hubbub/protocol/webrtc", not here: they need the DOM lib
// (RTCPeerConnection etc.), and this main barrel is imported by @hubbub/relay, which runs in
// Node/Workers with no DOM lib at all - pulling them in here breaks relay's typecheck.
