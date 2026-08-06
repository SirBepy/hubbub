import { SELF } from "cloudflare:test";

export async function createRoom(): Promise<string> {
  const res = await SELF.fetch("http://worker.local/api/rooms", { method: "POST" });
  if (res.status !== 201) throw new Error(`createRoom failed: ${res.status}`);
  const body = (await res.json()) as { code: string };
  return body.code;
}

export interface Conn {
  ws: WebSocket;
  status: number;
  /** Buffers every message from the moment of connection - SELF.fetch is in-process and fast
   * enough that a reply can beat a listener attached after send(), so buffering (not a
   * listen-after-send race) is what makes ordering assertions safe. */
  next(): Promise<any>;
}

export async function attach(code: string): Promise<Conn> {
  const res = await SELF.fetch(`http://worker.local/room/${code}`, { headers: { Upgrade: "websocket" } });
  const ws = res.webSocket as WebSocket;
  if (ws) ws.accept();

  const queue: any[] = [];
  const waiters: ((msg: any) => void)[] = [];
  ws?.addEventListener("message", (evt: MessageEvent) => {
    const data = JSON.parse(evt.data as string);
    const waiter = waiters.shift();
    if (waiter) waiter(data);
    else queue.push(data);
  });

  return {
    ws,
    status: res.status,
    next(): Promise<any> {
      if (queue.length) return Promise.resolve(queue.shift());
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("timeout waiting for a message")), 4000);
        waiters.push((msg) => { clearTimeout(timer); resolve(msg); });
      });
    },
  };
}
