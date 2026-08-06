// Pure classifier over an RTCPeerConnection.getStats() report. Never guesses from IP addresses -
// only reads the actually-selected candidate pair's real candidate types.
export type ConnectionTier = "direct" | "relay";

export interface StatsEntryLike {
  type: string;
  id?: string;
  state?: string;
  nominated?: boolean;
  localCandidateId?: string;
  remoteCandidateId?: string;
  candidateType?: string; // "host" | "srflx" | "prflx" | "relay"
}

export interface TierClassification {
  tier: ConnectionTier;
  // Debug/test detail only - the UI collapses host/srflx/prflx into one "direct" label per spec.
  detail: "host" | "srflx" | "prflx" | "relay" | "none";
}

/** Finds the succeeded (or nominated) candidate pair and reads its local/remote candidate
 * types. No pair, or a pair whose candidates can't be resolved, means "relay": the DataChannel
 * never usably connected, so the WebSocket fallback is what's actually carrying traffic. */
export function classifyConnectionTier(stats: Iterable<StatsEntryLike>): TierClassification {
  const entries = [...stats];
  const pair =
    entries.find((e) => e.type === "candidate-pair" && e.state === "succeeded") ??
    entries.find((e) => e.type === "candidate-pair" && e.nominated);
  if (!pair) return { tier: "relay", detail: "none" };

  const local = entries.find((e) => e.id === pair.localCandidateId);
  const remote = entries.find((e) => e.id === pair.remoteCandidateId);
  if (!local || !remote) return { tier: "relay", detail: "none" };

  const localType = local.candidateType;
  const remoteType = remote.candidateType;
  if (localType === "relay" || remoteType === "relay") return { tier: "relay", detail: "relay" };
  if (localType === "host" && remoteType === "host") return { tier: "direct", detail: "host" };
  if (localType === "prflx" || remoteType === "prflx") return { tier: "direct", detail: "prflx" };
  return { tier: "direct", detail: "srflx" };
}
