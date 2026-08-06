import type { ClientMessage, ServerMessage } from "./messages.js";
import type { ClientTransport } from "./transport.js";
import { WebSocketClientTransport } from "./transport.js";
import { classifyConnectionTier, type ConnectionTier, type StatsEntryLike } from "./ice-classify.js";
import { DEFAULT_STUN_URL } from "./constants.js";

export type TransportRole = "screen" | "controller";

export interface TierState {
  tier: ConnectionTier | null; // null = no peer link yet / still negotiating
  rttMs: number | null;
}

// Carried only inside the DataChannel payload - the relay/protocol wire schema never sees this,
// since the channel is a private hop between one controller and the screen (design constraint 2).
type ChannelWire = { k: "action"; payload: unknown } | { k: "ping"; id: number } | { k: "pong"; id: number };

type RtcSignalData =
  | { kind: "offer"; sdp: RTCSessionDescriptionInit }
  | { kind: "answer"; sdp: RTCSessionDescriptionInit }
  | { kind: "candidate"; candidate: RTCIceCandidateInit };

function isRtcSignalData(v: unknown): v is RtcSignalData {
  return !!v && typeof v === "object" && "kind" in v;
}

/** Only `action` ever crosses the DataChannel (design constraint 2) - everything else, including
 * rtcSignal itself, always stays on the WebSocket. */
export function isHotPathEligible(msg: ClientMessage): msg is Extract<ClientMessage, { t: "action" }> {
  return msg.t === "action";
}

/** A channel.send() can throw (e.g. the channel closing mid-send) - that must fall back to the
 * WebSocket per-message, never surface as an error to game code. */
export function trySendOverChannel(sendFn: () => void): boolean {
  try {
    sendFn();
    return true;
  } catch {
    return false;
  }
}

const PING_INTERVAL_MS = 2000;

/** One WebRTC peer connection: a controller has exactly one (to the screen); the screen has one
 * per connected controller, keyed by playerId. Not unit-tested - it touches RTCPeerConnection,
 * which does not exist in the Node test environment (no `wrtc`/`node-webrtc` dependency here). */
class PeerLink {
  readonly pc: RTCPeerConnection;
  channel: RTCDataChannel | null = null;
  private tierState: TierState = { tier: null, rttMs: null };
  private readonly pendingPings = new Map<number, number>();
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private nextPingId = 1;

  constructor(
    stunUrl: string,
    private readonly onSignal: (data: RtcSignalData) => void,
    private readonly onAction: (payload: unknown) => void,
    private readonly onTierChange: (state: TierState) => void,
  ) {
    this.pc = new RTCPeerConnection({ iceServers: stunUrl ? [{ urls: stunUrl }] : [] });
    this.pc.onicecandidate = (ev) => {
      if (ev.candidate) this.onSignal({ kind: "candidate", candidate: ev.candidate.toJSON() });
    };
    this.pc.ondatachannel = (ev) => this.bindChannel(ev.channel);
  }

  // Controller side only: it initiates, so it owns the channel and the offer.
  createOffer(): void {
    this.bindChannel(this.pc.createDataChannel("action"));
    this.pc
      .createOffer()
      .then((offer) => this.pc.setLocalDescription(offer))
      .then(() => {
        if (this.pc.localDescription) this.onSignal({ kind: "offer", sdp: this.pc.localDescription.toJSON() });
      })
      .catch(() => {});
  }

  async handleSignal(data: RtcSignalData): Promise<void> {
    if (data.kind === "offer") {
      await this.pc.setRemoteDescription(data.sdp);
      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);
      if (this.pc.localDescription) this.onSignal({ kind: "answer", sdp: this.pc.localDescription.toJSON() });
    } else if (data.kind === "answer") {
      await this.pc.setRemoteDescription(data.sdp);
    } else {
      // A candidate that arrives before setRemoteDescription, or after the link died, is routine.
      try {
        await this.pc.addIceCandidate(data.candidate);
      } catch {
        /* stray/late candidate - ignore */
      }
    }
  }

  get channelOpen(): boolean {
    return this.channel?.readyState === "open";
  }

  send(payload: unknown): boolean {
    const channel = this.channel;
    if (!channel || channel.readyState !== "open") return false;
    return trySendOverChannel(() => channel.send(JSON.stringify({ k: "action", payload } satisfies ChannelWire)));
  }

  close(): void {
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.channel?.close();
    this.pc.close();
  }

  private bindChannel(channel: RTCDataChannel): void {
    this.channel = channel;
    channel.onopen = () => {
      void this.refreshTier();
      this.pingTimer = setInterval(() => this.ping(), PING_INTERVAL_MS);
      this.ping();
    };
    channel.onclose = () => {
      if (this.pingTimer) clearInterval(this.pingTimer);
      this.tierState = { tier: "relay", rttMs: null };
      this.onTierChange(this.tierState);
    };
    channel.onmessage = (ev: MessageEvent) => {
      let wire: ChannelWire;
      try {
        wire = JSON.parse(String(ev.data));
      } catch {
        return;
      }
      if (wire.k === "action") this.onAction(wire.payload);
      else if (wire.k === "ping") channel.send(JSON.stringify({ k: "pong", id: wire.id } satisfies ChannelWire));
      else if (wire.k === "pong") this.resolvePong(wire.id);
    };
  }

  private ping(): void {
    if (this.channel?.readyState !== "open") return;
    const id = this.nextPingId++;
    this.pendingPings.set(id, Date.now());
    this.channel.send(JSON.stringify({ k: "ping", id } satisfies ChannelWire));
  }

  private resolvePong(id: number): void {
    const sentAt = this.pendingPings.get(id);
    if (sentAt === undefined) return;
    this.pendingPings.delete(id);
    this.tierState = { ...this.tierState, rttMs: Date.now() - sentAt };
    this.onTierChange(this.tierState);
  }

  private async refreshTier(): Promise<void> {
    try {
      const report = await this.pc.getStats();
      // RTCStatsReport only exposes forEach, not values() - collect into an array for the
      // pure classifier, which just needs something iterable.
      const entries: StatsEntryLike[] = [];
      report.forEach((v) => entries.push(v as StatsEntryLike));
      const { tier } = classifyConnectionTier(entries);
      this.tierState = { ...this.tierState, tier };
      this.onTierChange(this.tierState);
    } catch {
      /* stats unavailable this tick - leave tier as last known */
    }
  }
}

/** Decorates WebSocketClientTransport with an opportunistic WebRTC DataChannel for `action`
 * messages only (design constraint 2/3). Game code and the SDK only ever see ClientTransport -
 * this class is the one place in the repo that knows WebRTC exists. */
export class WebRtcClientTransport implements ClientTransport {
  private readonly ws: WebSocketClientTransport;
  private readonly messageHandlers = new Set<(msg: ServerMessage) => void>();
  private readonly stunUrl: string;
  private readonly onTierChange: (state: TierState) => void;
  // controller: one link, to the screen. screen: one link per controller, keyed by playerId.
  private controllerLink: PeerLink | null = null;
  private readonly screenLinks = new Map<string, PeerLink>();
  private wsUnsubMessage: () => void = () => {};

  constructor(
    url: string,
    private readonly role: TransportRole,
    opts: { stunUrl?: string; onTierChange?: (state: TierState) => void } = {},
  ) {
    this.ws = new WebSocketClientTransport(url);
    this.stunUrl = opts.stunUrl ?? DEFAULT_STUN_URL;
    this.onTierChange = opts.onTierChange ?? (() => {});
  }

  async connect(): Promise<void> {
    await this.ws.connect();
    this.wsUnsubMessage = this.ws.onMessage((msg) => this.handleWsMessage(msg));
  }

  send(msg: ClientMessage): void {
    if (this.role === "controller" && isHotPathEligible(msg) && this.controllerLink?.channelOpen) {
      if (this.controllerLink.send(msg.payload)) return;
    }
    this.ws.send(msg);
  }

  onMessage(handler: (msg: ServerMessage) => void): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  onClose(handler: () => void): () => void {
    return this.ws.onClose(handler);
  }

  close(): void {
    this.wsUnsubMessage();
    this.controllerLink?.close();
    for (const link of this.screenLinks.values()) link.close();
    this.screenLinks.clear();
    this.ws.close();
  }

  private dispatch(msg: ServerMessage): void {
    this.messageHandlers.forEach((h) => h(msg));
  }

  private handleWsMessage(msg: ServerMessage): void {
    if (msg.t === "rtcSignal") {
      void this.handleRtcSignal(msg);
      return; // signalling never reaches game/SDK code
    }
    if (msg.t === "joined" && this.role === "controller" && !this.controllerLink) {
      // Safe to start only once the relay has this connId's playerId registered (design
      // constraint 4) - "joined" is proof of that, since Room only replies after joinRoom.
      // Never let a WebRTC failure (no RTCPeerConnection, STUN unreachable, etc.) break the
      // base WS flow - this.dispatch(msg) below must always still run.
      try {
        this.startAsController();
      } catch {
        /* stays on the WebSocket - no DataChannel this session */
      }
    }
    this.dispatch(msg);
  }

  private startAsController(): void {
    const link = new PeerLink(
      this.stunUrl,
      (data) => this.ws.send({ t: "rtcSignal", data }),
      () => {}, // a controller's own channel never carries inbound `action` traffic
      (state) => this.onTierChange(state),
    );
    this.controllerLink = link;
    link.createOffer();
  }

  private async handleRtcSignal(msg: Extract<ServerMessage, { t: "rtcSignal" }>): Promise<void> {
    if (!isRtcSignalData(msg.data)) return;
    if (this.role === "controller") {
      try {
        await this.controllerLink?.handleSignal(msg.data);
      } catch {
        /* malformed/late signal - the channel just never opens for this peer */
      }
      return;
    }
    const playerId = msg.fromPlayerId;
    if (!playerId) return;
    try {
      let link = this.screenLinks.get(playerId);
      if (!link) {
        link = new PeerLink(
          this.stunUrl,
          (data) => this.ws.send({ t: "rtcSignal", toPlayerId: playerId, data }),
          // now stamped on arrival at the screen (design blocker #4), same as a WS-relayed action.
          (payload) => this.dispatch({ t: "gameAction", playerId, payload, now: Date.now() }),
          (state) => this.onTierChange(state),
        );
        this.screenLinks.set(playerId, link);
      }
      await link.handleSignal(msg.data);
    } catch {
      /* this one controller stays on the WebSocket - other peers/links are unaffected */
      this.screenLinks.delete(playerId);
    }
  }
}
