# Phase 3 - Portable Electron Host Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wrap the existing WS server + screen + controller into a double-click **portable** Electron app (no installer) that runs the whole game offline on a LAN, so real phones can join over WiFi and play Tic-Tac-Toe.

**Architecture:** A new `apps/host-desktop` Electron app. Its main process starts the existing `@hubbub/server` WS server, plus two tiny static HTTP servers: one for the **controller** PWA bound to `0.0.0.0` (phones reach it over the LAN) and one for the **screen** bound to `127.0.0.1` (the Electron window loads it). The main process detects the machine's LAN IP, builds the controller join URL from it, and injects `{ serverUrl, controllerUrl }` into the screen window via a `contextBridge` preload global. The server-side pieces live in an electron-free `host.ts` module so they are fully unit-testable; only `main.ts`/`preload.ts` touch Electron. The whole main process is bundled to a single CJS file with esbuild (sidestepping pnpm symlink issues), and electron-builder packages a Windows **portable** target.

**Tech Stack:** Electron 42, electron-builder 26 (portable target), esbuild 0.28 (bundle main/preload), Node 20 `http`/`os` (static server + LAN detection), existing `@hubbub/server` + `@hubbub/game-tictactoe`, Vitest.

## Global Constraints

- **Offline LAN = no CDNs.** All assets bundled into the apps; never CDN-load. (The screen/controller already build self-contained via Vite - the host only serves their `dist/`.)
- **The phone is a dumb controller; the screen renders everything.** The host changes transport plumbing only, never this invariant.
- **Transport is a swappable interface.** The host reuses `@hubbub/server`'s `ws` impl through its existing API; it must not import a concrete transport into game/SDK code.
- **Local vs cloud is one config flag** (server endpoint + QR target). The host supplies the local-mode values (`serverUrl`, `controllerUrl`); game code is unchanged.
- **No installer required.** Output a Windows **portable** `.exe` (double-click, no setup wizard, no admin).
- **License MIT;** copyright holder placeholder `Joe`.
- **Product codename `hubbub`.**
- Monorepo: pnpm workspaces + Turborepo, **concurrency capped at 5**.
- Default ports: WS `7787`, controller HTTP `7780`, screen HTTP `7781` (8787/5173/5174 are dev-only and taken on this machine).
- **Pinned new deps (safety-checked 2026-06-24, all clean):** `electron@^42.5.0`, `electron-builder@^26.15.3`, `esbuild@^0.28.1`.
- **Subagents stage only; never commit.** The orchestrator runs `/commit` after each task's report-back.

---

### Task 1: Scaffold `@hubbub/host-desktop` + server library export + LAN IP utility

**Files:**
- Create: `apps/host-desktop/package.json`
- Create: `apps/host-desktop/tsconfig.json`
- Create: `apps/host-desktop/src/lan.ts`
- Test: `apps/host-desktop/src/lan.test.ts`
- Modify: `apps/server/package.json` (add `main`/`types`/`exports` so the host can import `createServer`)

**Interfaces:**
- Produces: `getLanIp(ifaces?: NodeJS.Dict<NetworkInterfaceInfo[]>): string` - first non-internal IPv4, else `"127.0.0.1"`.
- Produces: `@hubbub/server` now resolves `import { createServer } from "@hubbub/server"` to `apps/server/src/server.ts` (existing signature `createServer(port: number, game?: GameLogic<any, any>) => { wss: WebSocketServer; close: () => Promise<void> }`).

- [ ] **Step 1: Create the package manifest**

`apps/host-desktop/package.json`:
```json
{
  "name": "@hubbub/host-desktop",
  "version": "0.0.0",
  "type": "module",
  "main": "dist/main.cjs",
  "scripts": {
    "build": "node esbuild.mjs",
    "dev": "electron dist/main.cjs",
    "package": "electron-builder --win portable --config electron-builder.yml",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@hubbub/server": "workspace:*",
    "@hubbub/sdk": "workspace:*",
    "@hubbub/protocol": "workspace:*",
    "@hubbub/game-tictactoe": "workspace:*",
    "ws": "^8.18.0"
  },
  "devDependencies": {
    "electron": "^42.5.0",
    "electron-builder": "^26.15.3",
    "esbuild": "^0.28.1",
    "@types/node": "^20.14.0",
    "@types/ws": "^8.5.0",
    "typescript": "^5.5.0"
  }
}
```

- [ ] **Step 2: Create the tsconfig**

`apps/host-desktop/tsconfig.json` (mirrors the other packages but explicitly enables Node + Vitest globals, since the base config narrows `types`):
```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src", "esbuild.mjs"],
  "compilerOptions": {
    "outDir": "dist",
    "types": ["vitest/globals", "node"]
  }
}
```

- [ ] **Step 3: Add a library export to `@hubbub/server`**

Modify `apps/server/package.json` - add `main`, `types`, and `exports` keys (between `"version"` and `"scripts"`) so the package is importable as a library (it currently only acts as a CLI entrypoint). The export points at `server.ts` (which holds `createServer`), NOT `index.ts` (the CLI):
```json
  "main": "./src/server.ts",
  "types": "./src/server.ts",
  "exports": { ".": "./src/server.ts" },
```

- [ ] **Step 4: Write the failing test**

`apps/host-desktop/src/lan.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { getLanIp } from "./lan.js";

describe("getLanIp", () => {
  it("returns the first non-internal IPv4 address", () => {
    const ip = getLanIp({
      lo: [{ family: "IPv4", internal: true, address: "127.0.0.1" } as any],
      eth0: [{ family: "IPv4", internal: false, address: "192.168.1.42" } as any],
    });
    expect(ip).toBe("192.168.1.42");
  });

  it("skips IPv6 and returns the IPv4 address", () => {
    const ip = getLanIp({
      eth0: [
        { family: "IPv6", internal: false, address: "fe80::1" } as any,
        { family: "IPv4", internal: false, address: "10.0.0.5" } as any,
      ],
    });
    expect(ip).toBe("10.0.0.5");
  });

  it("falls back to 127.0.0.1 when no external IPv4 exists", () => {
    const ip = getLanIp({
      lo: [{ family: "IPv4", internal: true, address: "127.0.0.1" } as any],
    });
    expect(ip).toBe("127.0.0.1");
  });
});
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `pnpm vitest run apps/host-desktop/src/lan.test.ts`
Expected: FAIL - cannot resolve `./lan.js` (module does not exist yet).

- [ ] **Step 6: Implement `getLanIp`**

`apps/host-desktop/src/lan.ts`:
```ts
import { networkInterfaces, type NetworkInterfaceInfo } from "node:os";

/** Returns the first non-internal IPv4 address on this machine, or 127.0.0.1 if none. */
export function getLanIp(
  ifaces: NodeJS.Dict<NetworkInterfaceInfo[]> = networkInterfaces(),
): string {
  for (const list of Object.values(ifaces)) {
    for (const info of list ?? []) {
      if (info.family === "IPv4" && !info.internal) return info.address;
    }
  }
  return "127.0.0.1";
}
```

- [ ] **Step 7: Install deps and verify the test passes**

Run: `pnpm install` (picks up the new workspace package + deps), then `pnpm vitest run apps/host-desktop/src/lan.test.ts`
Expected: PASS (3 tests). Also run `pnpm --filter @hubbub/host-desktop typecheck` - expect no errors.

- [ ] **Step 8: Stage changes**

Stage `apps/host-desktop/package.json`, `apps/host-desktop/tsconfig.json`, `apps/host-desktop/src/lan.ts`, `apps/host-desktop/src/lan.test.ts`, `apps/server/package.json`, and the updated `pnpm-lock.yaml`. Do NOT commit - the orchestrator runs `/commit`.

---

### Task 2: Static file server

**Files:**
- Create: `apps/host-desktop/src/static-server.ts`
- Test: `apps/host-desktop/src/static-server.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `startStaticServer(dir: string, port: number, host: string): Promise<StaticServer>` where `interface StaticServer { server: import("node:http").Server; port: number; close: () => Promise<void> }`. Serves `dir` as an SPA: directory paths -> `index.html`, extension-less unknown routes fall back to `index.html`, known-extension misses -> 404. `port: 0` lets the OS pick; the resolved port is returned in `.port`.

- [ ] **Step 1: Write the failing test**

`apps/host-desktop/src/static-server.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startStaticServer, type StaticServer } from "./static-server.js";

let dir: string;
let srv: StaticServer;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "hubbub-static-"));
  await writeFile(join(dir, "index.html"), "<!doctype html><title>hi</title>");
  await writeFile(join(dir, "app.js"), "export const x = 1;");
  srv = await startStaticServer(dir, 0, "127.0.0.1");
});

afterAll(async () => {
  await srv.close();
  await rm(dir, { recursive: true, force: true });
});

describe("startStaticServer", () => {
  it("serves index.html at the root with an html content-type", async () => {
    const res = await fetch(`http://127.0.0.1:${srv.port}/`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(await res.text()).toContain("<title>hi</title>");
  });

  it("serves JS with a script content-type", async () => {
    const res = await fetch(`http://127.0.0.1:${srv.port}/app.js`);
    expect(res.headers.get("content-type")).toContain("javascript");
    expect(await res.text()).toContain("export const x");
  });

  it("falls back to index.html for extension-less routes (query-only joins)", async () => {
    const res = await fetch(`http://127.0.0.1:${srv.port}/lobby`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("<title>hi</title>");
  });

  it("404s for a missing asset that has a file extension", async () => {
    const res = await fetch(`http://127.0.0.1:${srv.port}/missing.css`);
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run apps/host-desktop/src/static-server.test.ts`
Expected: FAIL - cannot resolve `./static-server.js`.

- [ ] **Step 3: Implement the static server**

`apps/host-desktop/src/static-server.ts`:
```ts
import { createServer, type Server } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname, normalize } from "node:path";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json",
};

export interface StaticServer {
  server: Server;
  port: number;
  close: () => Promise<void>;
}

/**
 * Serves a built SPA directory. Directory paths and extension-less unknown
 * routes fall back to index.html so client-side routing and query-only join
 * URLs (`/?room=ABCD`) work. Path traversal is stripped.
 */
export function startStaticServer(
  dir: string,
  port: number,
  host: string,
): Promise<StaticServer> {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://localhost");
      let pathname = decodeURIComponent(url.pathname);
      if (pathname.endsWith("/")) pathname += "index.html";
      const safe = normalize(pathname)
        .replace(/^(\.\.[/\\])+/, "")
        .replace(/^[/\\]+/, "");
      let filePath = join(dir, safe);
      let ext = extname(filePath);
      let body: Buffer;
      try {
        body = await readFile(filePath);
      } catch {
        if (ext === "") {
          filePath = join(dir, "index.html");
          ext = ".html";
          body = await readFile(filePath);
        } else {
          res.writeHead(404, { "content-type": "text/plain" });
          res.end("Not found");
          return;
        }
      }
      res.writeHead(200, {
        "content-type": MIME[ext] ?? "application/octet-stream",
      });
      res.end(body);
    } catch {
      res.writeHead(500, { "content-type": "text/plain" });
      res.end("Server error");
    }
  });
  return new Promise((resolve) => {
    server.listen(port, host, () => {
      const addr = server.address();
      const actualPort = typeof addr === "object" && addr ? addr.port : port;
      resolve({
        server,
        port: actualPort,
        close: () => new Promise<void>((r) => server.close(() => r())),
      });
    });
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run apps/host-desktop/src/static-server.test.ts`
Expected: PASS (4 tests). Also `pnpm --filter @hubbub/host-desktop typecheck` - no errors.

- [ ] **Step 5: Stage changes**

Stage `apps/host-desktop/src/static-server.ts` and `apps/host-desktop/src/static-server.test.ts`. Do NOT commit.

---

### Task 3: `startHost` orchestration (WS + two static servers + LAN URLs)

**Files:**
- Create: `apps/host-desktop/src/host.ts`
- Test: `apps/host-desktop/src/host.test.ts`

**Interfaces:**
- Consumes: `getLanIp` (Task 1), `startStaticServer`/`StaticServer` (Task 2), `createServer` from `@hubbub/server` (Task 1), `tttLogic` from `@hubbub/game-tictactoe`.
- Produces: `startHost(opts: HostOptions): Promise<RunningHost>` where
  ```ts
  interface HostOptions {
    screenDir: string;
    controllerDir: string;
    wsPort?: number;          // default 7787; pass 0 in tests for an OS-assigned port
    controllerPort?: number;  // default 7780
    screenPort?: number;      // default 7781
    game?: GameLogic<any, any>; // default tttLogic
  }
  interface RunningHost {
    lanIp: string;
    serverUrl: string;      // ws://localhost:<wsPort>  (the screen's own WS connection)
    controllerUrl: string;  // http://<lanIp>:<controllerPort>  (the phone join URL)
    screenUrl: string;      // http://127.0.0.1:<screenPort>  (what Electron loads)
    wsPort: number;
    close: () => Promise<void>;
  }
  ```

- [ ] **Step 1: Write the failing test**

`apps/host-desktop/src/host.test.ts` (uses the `ws` package directly, matching the existing server tests in `apps/server/src/server.test.ts`):
```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WebSocket } from "ws";
import { startHost, type RunningHost } from "./host.js";

let screenDir: string;
let controllerDir: string;
let host: RunningHost;

const open = (url: string) =>
  new Promise<WebSocket>((res) => {
    const ws = new WebSocket(url);
    ws.on("open", () => res(ws));
  });
const nextOf = (ws: WebSocket, t: string) =>
  new Promise<any>((res) => {
    const h = (m: any) => {
      const msg = JSON.parse(m.toString());
      if (msg.t === t) {
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

  it("accepts a screen createRoom then a controller join over WS", async () => {
    const screen = await open(host.serverUrl);
    screen.send(JSON.stringify({ t: "createRoom" }));
    const created = await nextOf(screen, "roomCreated");
    expect(created.code).toHaveLength(4);

    const phone = await open(host.serverUrl);
    phone.send(JSON.stringify({ t: "joinRoom", code: created.code, name: "Ada" }));
    const joined = await nextOf(phone, "joined");
    expect(joined.playerId).toBeTruthy();

    screen.close();
    phone.close();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run apps/host-desktop/src/host.test.ts`
Expected: FAIL - cannot resolve `./host.js`.

- [ ] **Step 3: Implement `startHost`**

`apps/host-desktop/src/host.ts`:
```ts
import { createServer as createWsServer } from "@hubbub/server";
import { tttLogic } from "@hubbub/game-tictactoe";
import type { GameLogic } from "@hubbub/sdk";
import { getLanIp } from "./lan.js";
import { startStaticServer } from "./static-server.js";

export interface HostOptions {
  screenDir: string;
  controllerDir: string;
  wsPort?: number;
  controllerPort?: number;
  screenPort?: number;
  game?: GameLogic<any, any>;
}

export interface RunningHost {
  lanIp: string;
  serverUrl: string;
  controllerUrl: string;
  screenUrl: string;
  wsPort: number;
  close: () => Promise<void>;
}

export async function startHost(opts: HostOptions): Promise<RunningHost> {
  const lanIp = getLanIp();

  const ws = createWsServer(opts.wsPort ?? 7787, opts.game ?? tttLogic);
  const wsPort = (ws.wss.address() as { port: number }).port;

  const controller = await startStaticServer(
    opts.controllerDir,
    opts.controllerPort ?? 7780,
    "0.0.0.0",
  );
  const screen = await startStaticServer(
    opts.screenDir,
    opts.screenPort ?? 7781,
    "127.0.0.1",
  );

  return {
    lanIp,
    serverUrl: `ws://localhost:${wsPort}`,
    controllerUrl: `http://${lanIp}:${controller.port}`,
    screenUrl: `http://127.0.0.1:${screen.port}`,
    wsPort,
    close: async () => {
      await ws.close();
      await controller.close();
      await screen.close();
    },
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run apps/host-desktop/src/host.test.ts`
Expected: PASS (4 tests). Also `pnpm --filter @hubbub/host-desktop typecheck` - no errors.

- [ ] **Step 5: Stage changes**

Stage `apps/host-desktop/src/host.ts` and `apps/host-desktop/src/host.test.ts`. Do NOT commit.

---

### Task 4: Screen config injection (LAN URLs from the host)

**Files:**
- Create: `apps/screen/src/config-resolve.ts`
- Test: `apps/screen/src/config-resolve.test.ts`
- Modify: `apps/screen/src/config.ts`

**Interfaces:**
- Produces: `resolveConfig(injected, env, hostname): HubbubConfig` - a pure function (no `location`/`import.meta` at module scope, so it is unit-testable in the Node Vitest env). `interface HubbubConfig { serverUrl: string; controllerUrl: string }`. Precedence: injected global (`window.__HUBBUB__`, set by the Electron preload) > Vite env var > `location.hostname` default.
- `config.ts` keeps exporting the same `SERVER_URL` and `CONTROLLER_URL` consts the screen `App.tsx` already imports - no consumer change.

- [ ] **Step 1: Write the failing test**

`apps/screen/src/config-resolve.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { resolveConfig } from "./config-resolve.js";

describe("resolveConfig", () => {
  it("prefers the injected host config (Electron preload)", () => {
    const cfg = resolveConfig(
      { serverUrl: "ws://localhost:7787", controllerUrl: "http://192.168.1.42:7780" },
      {},
      "127.0.0.1",
    );
    expect(cfg.serverUrl).toBe("ws://localhost:7787");
    expect(cfg.controllerUrl).toBe("http://192.168.1.42:7780");
  });

  it("falls back to Vite env vars when nothing is injected", () => {
    const cfg = resolveConfig(
      undefined,
      { VITE_SERVER_URL: "ws://cloud:9000", VITE_CONTROLLER_URL: "https://app" },
      "example.com",
    );
    expect(cfg.serverUrl).toBe("ws://cloud:9000");
    expect(cfg.controllerUrl).toBe("https://app");
  });

  it("falls back to hostname-derived defaults last", () => {
    const cfg = resolveConfig(undefined, {}, "myhost");
    expect(cfg.serverUrl).toBe("ws://myhost:7787");
    expect(cfg.controllerUrl).toBe("http://myhost:5174");
  });

  it("uses an injected value even if a partial injection omits the other", () => {
    const cfg = resolveConfig({ controllerUrl: "http://1.2.3.4:7780" }, {}, "myhost");
    expect(cfg.serverUrl).toBe("ws://myhost:7787");
    expect(cfg.controllerUrl).toBe("http://1.2.3.4:7780");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run apps/screen/src/config-resolve.test.ts`
Expected: FAIL - cannot resolve `./config-resolve.js`.

- [ ] **Step 3: Implement the pure resolver**

`apps/screen/src/config-resolve.ts`:
```ts
export interface HubbubConfig {
  serverUrl: string;
  controllerUrl: string;
}

/**
 * Resolves the screen's transport config. Precedence:
 *   injected host config (Electron preload window.__HUBBUB__)
 *   > Vite env vars
 *   > hostname-derived local defaults.
 */
export function resolveConfig(
  injected: Partial<HubbubConfig> | undefined,
  env: { VITE_SERVER_URL?: string; VITE_CONTROLLER_URL?: string },
  hostname: string,
): HubbubConfig {
  return {
    serverUrl: injected?.serverUrl ?? env.VITE_SERVER_URL ?? `ws://${hostname}:7787`,
    controllerUrl:
      injected?.controllerUrl ?? env.VITE_CONTROLLER_URL ?? `http://${hostname}:5174`,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run apps/screen/src/config-resolve.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Rewire `config.ts` to use the resolver**

Replace the entire contents of `apps/screen/src/config.ts` with:
```ts
import { resolveConfig, type HubbubConfig } from "./config-resolve";

// Electron's preload injects window.__HUBBUB__ in local host mode.
declare global {
  interface Window {
    __HUBBUB__?: Partial<HubbubConfig>;
  }
}

const cfg = resolveConfig(
  typeof window !== "undefined" ? window.__HUBBUB__ : undefined,
  import.meta.env,
  typeof location !== "undefined" ? location.hostname : "localhost",
);

export const SERVER_URL = cfg.serverUrl;
export const CONTROLLER_URL = cfg.controllerUrl;
```

- [ ] **Step 6: Verify screen still typechecks and builds**

Run: `pnpm --filter @hubbub/screen typecheck` then `pnpm --filter @hubbub/screen build`
Expected: both succeed; `apps/screen/dist/` is produced.

- [ ] **Step 7: Stage changes**

Stage `apps/screen/src/config-resolve.ts`, `apps/screen/src/config-resolve.test.ts`, and `apps/screen/src/config.ts`. Do NOT commit.

---

### Task 5: Electron main process + preload (config injection into the window)

**Files:**
- Create: `apps/host-desktop/src/main.ts`
- Create: `apps/host-desktop/src/preload.ts`

**Interfaces:**
- Consumes: `startHost`/`RunningHost` (Task 3).
- Produces: the Electron entry. On `app.whenReady()` it calls `startHost`, opens a `BrowserWindow` loading `host.screenUrl`, and passes `{ serverUrl, controllerUrl }` to the preload via `webPreferences.additionalArguments`. The preload exposes that object as `window.__HUBBUB__` (consumed by Task 4's `config.ts`).
- Static-asset location at runtime: packaged -> `process.resourcesPath/static/...`; dev -> `<__dirname>/../static/...` (i.e. `apps/host-desktop/static/...`, populated by Task 6's build).

> Note: this task has **no automated test** - it is the Electron shell, which needs a display. Its server-side logic is already covered by Task 3's `startHost` tests. Verification is the orchestrator launching the dev host (after Task 6 wires the build) and a human joining from a real phone (handed off as a BEPY todo).

- [ ] **Step 1: Implement the preload**

`apps/host-desktop/src/preload.ts`:
```ts
import { contextBridge } from "electron";

const PREFIX = "--hubbub-config=";
const arg = process.argv.find((a) => a.startsWith(PREFIX));
const config = arg ? JSON.parse(arg.slice(PREFIX.length)) : {};

contextBridge.exposeInMainWorld("__HUBBUB__", config);
```

- [ ] **Step 2: Implement the main process**

`apps/host-desktop/src/main.ts`:
```ts
import { app, BrowserWindow } from "electron";
import { join } from "node:path";
import { startHost, type RunningHost } from "./host.js";

let host: RunningHost | undefined;

async function createWindow() {
  const base = app.isPackaged ? process.resourcesPath : join(__dirname, "..");

  host = await startHost({
    screenDir: join(base, "static", "screen"),
    controllerDir: join(base, "static", "controller"),
  });

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    backgroundColor: "#111111",
    webPreferences: {
      preload: join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      additionalArguments: [
        `--hubbub-config=${JSON.stringify({
          serverUrl: host.serverUrl,
          controllerUrl: host.controllerUrl,
        })}`,
      ],
    },
  });

  await win.loadURL(host.screenUrl + "/");
}

app.whenReady().then(createWindow);

app.on("window-all-closed", async () => {
  await host?.close();
  host = undefined;
  if (process.platform !== "darwin") app.quit();
});
```

> `__dirname` is valid here: esbuild bundles this to CJS (`dist/main.cjs`, Task 6), where `__dirname` is a real runtime global, and `@types/node` types it for `tsc`.

- [ ] **Step 3: Verify it typechecks**

Run: `pnpm --filter @hubbub/host-desktop typecheck`
Expected: no errors. (Runtime launch is verified in Task 6 once the build/bundle exists.)

- [ ] **Step 4: Stage changes**

Stage `apps/host-desktop/src/main.ts` and `apps/host-desktop/src/preload.ts`. Do NOT commit.

---

### Task 6: Build bundling (esbuild) + portable packaging (electron-builder)

**Files:**
- Create: `apps/host-desktop/esbuild.mjs`
- Create: `apps/host-desktop/electron-builder.yml`
- Create: `apps/host-desktop/.gitignore`
- Modify: `package.json` (root - add `host:build` / `host:dev` / `host:package` scripts)

**Interfaces:**
- Consumes: all prior tasks. Requires `apps/screen/dist` and `apps/controller/dist` to exist (Turbo `^build` builds them first).
- Produces: `apps/host-desktop/dist/main.cjs` + `dist/preload.cjs` (bundled, externalizing `electron`, `bufferutil`, `utf-8-validate`), `apps/host-desktop/static/{screen,controller}` (copied web builds), and a portable `release/*.exe`.

- [ ] **Step 1: Write the esbuild bundler + static copy script**

`apps/host-desktop/esbuild.mjs`:
```js
import { build } from "esbuild";
import { cpSync, rmSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(fileURLToPath(import.meta.url));
const external = ["electron", "bufferutil", "utf-8-validate"];

const common = {
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  external,
};

await build({ ...common, entryPoints: [join(root, "src/main.ts")], outfile: join(root, "dist/main.cjs") });
await build({ ...common, entryPoints: [join(root, "src/preload.ts")], outfile: join(root, "dist/preload.cjs") });

// Copy the built web apps so they ship inside the portable exe (offline, no CDN).
const staticDir = join(root, "static");
rmSync(staticDir, { recursive: true, force: true });
mkdirSync(staticDir, { recursive: true });
cpSync(join(root, "../screen/dist"), join(staticDir, "screen"), { recursive: true });
cpSync(join(root, "../controller/dist"), join(staticDir, "controller"), { recursive: true });

console.log("host-desktop build complete: dist/main.cjs, dist/preload.cjs, static/{screen,controller}");
```

- [ ] **Step 2: Write the electron-builder config (portable target)**

`apps/host-desktop/electron-builder.yml`:
```yaml
appId: com.hubbub.host
productName: Hubbub
directories:
  output: release
files:
  - dist/**
extraResources:
  - from: static
    to: static
win:
  target:
    - portable
portable:
  artifactName: Hubbub-portable.exe
```

- [ ] **Step 3: Ignore build outputs**

`apps/host-desktop/.gitignore`:
```
dist/
static/
release/
```

- [ ] **Step 4: Add root scripts**

Modify the root `package.json` `scripts` block - add these three entries (keep existing ones):
```json
    "host:build": "turbo run build --concurrency=5 --filter=@hubbub/host-desktop",
    "host:dev": "turbo run build --concurrency=5 --filter=@hubbub/screen --filter=@hubbub/controller && pnpm --filter @hubbub/host-desktop build && pnpm --filter @hubbub/host-desktop dev",
    "host:package": "pnpm host:build && pnpm --filter @hubbub/host-desktop package",
```

- [ ] **Step 5: Build the host bundle**

Run: `pnpm host:build`
Expected: Turbo builds `@hubbub/screen`, `@hubbub/controller` (and their deps), then runs the host's `build` (esbuild). Confirm these exist afterward:
- `apps/host-desktop/dist/main.cjs`
- `apps/host-desktop/dist/preload.cjs`
- `apps/host-desktop/static/screen/index.html`
- `apps/host-desktop/static/controller/index.html`

- [ ] **Step 6: Verify the full repo still passes its checks**

Run: `pnpm typecheck` (expect 7 packages ok now) and `pnpm test` (expect the prior 27 + the new host/config tests, ~38 total).

- [ ] **Step 7: Produce the portable exe**

Run: `pnpm host:package`
Expected: electron-builder downloads the Electron 42 binary (first run only) and writes `apps/host-desktop/release/Hubbub-portable.exe`. Confirm the file exists.
> If electron-builder fails to fetch the Electron binary offline / behind a proxy, that is an environment issue, not a code defect - report it and hand the packaging step to Joe rather than retrying blindly.

- [ ] **Step 8: Stage changes**

Stage `apps/host-desktop/esbuild.mjs`, `apps/host-desktop/electron-builder.yml`, `apps/host-desktop/.gitignore`, and the root `package.json`. Do NOT commit. (`dist/`, `static/`, `release/` are gitignored.)

---

## Post-plan verification (orchestrator, lead session)

These are NOT subagent tasks - the orchestrator runs them after the tasks land:

1. **Full checks:** `pnpm typecheck` (7 ok), `pnpm test` (~38 passing), `pnpm -w build`.
2. **Headless host e2e (Playwright, no Electron window needed):** run a small Node harness that imports `startHost` (temp = real `apps/screen/dist` + `apps/controller/dist`), then Playwright-load `screenUrl/` with an init script setting `window.__HUBBUB__ = { serverUrl, controllerUrl }`, load `controllerUrl/?room=<code>` in a second context, join two players, play a full TTT game, and assert the screen + controllers stay in sync. This validates every host piece except the Electron shell.
3. **Electron shell + real phone (hand to Joe, write a BEPY todo):** `pnpm host:dev` opens the screen window; scan the QR from a phone on the same WiFi and play. Then double-click `release/Hubbub-portable.exe` and repeat - confirms the portable build serves + runs with zero install.

## Open follow-ups (not in this plan)

- Port collision robustness: the controller's WS port is the fixed default `7787`; if busy on a friend's machine the phone can't reach it. Negotiated/advertised ports are future work.
- App icon + window chrome polish (currently default Electron icon, windowed 1280x800; consider fullscreen + Wake Lock wiring on the screen).
- macOS/Linux portable targets (this plan ships Windows portable only).
