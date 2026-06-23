import {
  parseServerMessage,
  type ClientMessage,
  type ServerMessage,
} from "./messages.js";

// The client transport boundary. WebSocket is the first implementation;
// a future WebRTC DataChannel impl plugs in behind this same interface.
// Game/app code must depend on ClientTransport, never a concrete class.
export interface ClientTransport {
  connect(): Promise<void>;
  send(msg: ClientMessage): void;
  onMessage(handler: (msg: ServerMessage) => void): () => void; // returns unsubscribe
  onClose(handler: () => void): () => void;
  close(): void;
}

// Uses the global WHATWG WebSocket (native in browsers, global in Node 20+),
// so this module bundles cleanly for the browser with no Node-only deps.
export class WebSocketClientTransport implements ClientTransport {
  private ws?: WebSocket;
  private messageHandlers = new Set<(msg: ServerMessage) => void>();
  private closeHandlers = new Set<() => void>();

  constructor(private url: string) {}

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.url);
      this.ws = ws;
      ws.addEventListener("open", () => resolve());
      ws.addEventListener("error", (e) => reject(e));
      ws.addEventListener("close", () => this.closeHandlers.forEach((h) => h()));
      ws.addEventListener("message", (ev: MessageEvent) => {
        const msg = parseServerMessage(String(ev.data));
        this.messageHandlers.forEach((h) => h(msg));
      });
    });
  }

  send(msg: ClientMessage): void {
    this.ws?.send(JSON.stringify(msg));
  }

  onMessage(handler: (msg: ServerMessage) => void): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  onClose(handler: () => void): () => void {
    this.closeHandlers.add(handler);
    return () => this.closeHandlers.delete(handler);
  }

  close(): void {
    this.ws?.close();
  }
}
