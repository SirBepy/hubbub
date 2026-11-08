import { describe, expect, it } from "vitest";
import { frameCspFor, relayConnectOrigins, sandboxHeadersFile, selectBundles } from "./build-assets";

describe("sandboxHeadersFile", () => {
  const text = sandboxHeadersFile({
    shellOrigin: "https://hubbub.example.dev/",
    relayOrigin: "https://hubbub.example.dev",
  });

  it("pins frame-ancestors to the shell origin and allows its relay over http and ws", () => {
    expect(text).toContain("frame-ancestors https://hubbub.example.dev;");
    expect(text).toContain("connect-src 'self' https://hubbub.example.dev wss://hubbub.example.dev;");
  });

  it("opens CORS on every path, for the opaque-origin frame", () => {
    expect(text).toMatch(/^\/\*\n(  .+\n)*  Access-Control-Allow-Origin: \*\n/m);
  });

  it("revalidates bundles and the frame document instead of caching them immutably", () => {
    expect(text).toMatch(/^\/games\/\*\n(  .+\n)*  Cache-Control: no-cache\n/m);
    expect(text).toMatch(/^\/frame\.html\n  Cache-Control: no-cache\n/m);
    expect(text).not.toContain("immutable");
  });

  it("serves bundles as nosniff javascript", () => {
    expect(text).toMatch(/^\/games\/\*\n  Content-Type: text\/javascript; charset=utf-8\n  X-Content-Type-Options: nosniff\n/m);
  });

  it("keeps every line under Cloudflare's 2000 character _headers limit", () => {
    for (const line of text.split("\n")) expect(line.length).toBeLessThan(2000);
  });

  it("rejects an origin that is not a URL rather than emitting a CSP that never matches", () => {
    expect(() => sandboxHeadersFile({ shellOrigin: "hubbub", relayOrigin: "https://a.dev" })).toThrow();
  });
});

describe("relayConnectOrigins", () => {
  it("maps http to ws and https to wss, dropping any path", () => {
    expect(relayConnectOrigins("http://localhost:8788/x")).toEqual(["http://localhost:8788", "ws://localhost:8788"]);
    expect(relayConnectOrigins("https://a.dev")).toEqual(["https://a.dev", "wss://a.dev"]);
  });
});

describe("frameCspFor", () => {
  it("gives the dev and production CSP the same connect-src for a trailing-slash relay origin", () => {
    const dev = frameCspFor({
      shellOrigin: "http://localhost:5175/",
      relayOrigin: "http://localhost:7787/",
      extraConnect: ["ws://localhost:5176"],
    });
    const prod = sandboxHeadersFile({ shellOrigin: "http://localhost:5175/", relayOrigin: "http://localhost:7787/" });
    expect(dev).toContain("connect-src 'self' http://localhost:7787 ws://localhost:7787 ws://localhost:5176;");
    expect(prod).toContain("connect-src 'self' http://localhost:7787 ws://localhost:7787;");
    expect(dev).toContain("frame-ancestors http://localhost:5175;");
  });
});

describe("selectBundles", () => {
  it("copies bundles that exist to games/<id>/dev.js and reports the rest as missing", () => {
    const on = new Set(["/g/tap/dist/bundle.js"]);
    const { found, missing } = selectBundles(
      { "tap-race": "/g/tap/dist/bundle.js", ttt: "/repo/ttt/dist/bundle.js" },
      (f) => on.has(f),
    );
    expect(found).toEqual([{ id: "tap-race", src: "/g/tap/dist/bundle.js", dest: "games/tap-race/dev.js" }]);
    expect(missing).toEqual(["ttt"]);
  });
});
