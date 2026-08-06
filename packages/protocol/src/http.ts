// Room-creation HTTP call and the room WebSocket URL, both derived from one base URL so
// ws:// <-> http:// (and wss:// <-> https://) scheme translation lives in exactly one place.
function toHttpBase(baseUrl: string): string {
  if (baseUrl.startsWith("wss://")) return `https://${baseUrl.slice(6)}`;
  if (baseUrl.startsWith("ws://")) return `http://${baseUrl.slice(5)}`;
  return baseUrl;
}

export async function createRoomHttp(baseUrl: string): Promise<string> {
  const res = await fetch(`${toHttpBase(baseUrl)}/api/rooms`, { method: "POST" });
  if (!res.ok) throw new Error(`createRoom failed: ${res.status}`);
  const body = (await res.json()) as { code: string };
  return body.code;
}

export function roomSocketUrl(baseUrl: string, code: string): string {
  return `${baseUrl}/room/${code}`;
}
