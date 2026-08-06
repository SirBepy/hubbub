import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WebSocket } from "ws";
import { ROOM_CODE_LENGTH, createRoomHttp, roomSocketUrl } from "@hubbub/protocol";
import { startHost, type RunningHost } from "./host.js";

let screenDir: string;
let controllerDir: string;
let host: RunningHost;

const open = (url: string) =>
  new Promise<WebSocket>((res, rej) => {
    const ws = new WebSocket(url);
    ws.on("open", () => res(ws));
    ws.on("error", rej);
  });
const nextOf = (ws: WebSocket, t: string) =>
  new Promise<any>((res, rej) => {
    const timer = setTimeout(() => rej(new Error(`timed out waiting for "${t}"`)), 4000);
    const h = (m: any) => {
      const msg = JSON.parse(m.toString());
      if (msg.t === t) {
        clearTimeout(timer);
        ws.off("message", h);
        res(msg);
      }
    };
    ws.on("message", h);
  });

beforeAll(async () => {
  screenDir = await mkdtemp(join(tmpdir(), "hubbub-screen-"));
  controllerDir = await mkdtemp(join(tmpdir(), "hubbub-controller-"));
  await writeFile(join(screenDir, "index.html"), "<title>screen</title>");
  await writeFile(join(controllerDir, "index.html"), "<title>controller</title>");
  host = await startHost({
    screenDir,
    controllerDir,
    wsPort: 0,
    controllerPort: 0,
    screenPort: 0,
  });
});

afterAll(async () => {
  await host.close();
  await rm(screenDir, { recursive: true, force: true });
  await rm(controllerDir, { recursive: true, force: true });
});

describe("startHost", () => {
  it("reports a LAN controller URL and a localhost screen URL", () => {
    expect(host.controllerUrl).toMatch(/^http:\/\/.+:\d+$/);
    expect(host.screenUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    expect(host.serverUrl).toBe(`ws://localhost:${host.wsPort}`);
  });

  it("serves the controller app over HTTP", async () => {
    const port = new URL(host.controllerUrl).port;
    const res = await fetch(`http://127.0.0.1:${port}/`);
    expect(await res.text()).toContain("<title>controller</title>");
  });

  it("serves the screen app over HTTP", async () => {
    const res = await fetch(host.screenUrl + "/");
    expect(await res.text()).toContain("<title>screen</title>");
  });

  it("accepts a screen attachScreen then a controller join over WS", async () => {
    const code = await createRoomHttp(host.serverUrl);
    expect(code).toHaveLength(ROOM_CODE_LENGTH);

    const screen = await open(roomSocketUrl(host.serverUrl, code));
    screen.send(JSON.stringify({ t: "attachScreen" }));
    await nextOf(screen, "roomCreated");

    const phone = await open(roomSocketUrl(host.serverUrl, code));
    phone.send(JSON.stringify({ t: "joinRoom", name: "Ada", colorId: 3, emoji: "🦊" }));
    const joined = await nextOf(phone, "joined");
    expect(joined.playerId).toBeTruthy();

    screen.close();
    phone.close();
  });
});
