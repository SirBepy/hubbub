import { describe, it, expect, afterEach, vi } from "vitest";
import { SELF, reset } from "cloudflare:test";

// SELF.fetch runs the worker in the same isolate as this test file (per cloudflare:test docs),
// so stubbing the global fetch here also intercepts the worker's own upstream fetch() call.
afterEach(async () => {
  vi.unstubAllGlobals();
  await reset();
});

describe("Deezer proxy", () => {
  it("proxies an allowlisted path through and returns JSON with CORS headers", async () => {
    const upstream = vi.fn(async (input: string | URL) => {
      expect(String(input)).toBe("https://api.deezer.com/search?q=queen");
      return new Response(JSON.stringify({ data: [{ title: "Bohemian Rhapsody" }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", upstream);

    const res = await SELF.fetch("http://worker.local/proxy/deezer/search?q=queen");
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    const body = (await res.json()) as { data: { title: string }[] };
    expect(body.data[0].title).toBe("Bohemian Rhapsody");
    expect(upstream).toHaveBeenCalledTimes(1);
  });

  it("rejects a non-allowlisted Deezer path before ever touching the upstream fetch", async () => {
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);

    const res = await SELF.fetch("http://worker.local/proxy/deezer/user/12345");
    expect(res.status).toBe(404);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("rejects a path-traversal attempt trying to escape to another upstream path", async () => {
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);

    // Encoded so the URL parser doesn't collapse the ".." itself - proves the allowlist regex,
    // not URL normalization, is what rejects it.
    const res = await SELF.fetch("http://worker.local/proxy/deezer/track/1%2f..%2f..%2fapi%2frooms");
    expect(res.status).toBe(404);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("rejects a non-GET method with 405", async () => {
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);

    const res = await SELF.fetch("http://worker.local/proxy/deezer/search?q=queen", { method: "POST" });
    expect(res.status).toBe(405);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("logs the real failure reason and returns 502 when the upstream fetch throws", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network unreachable"); }));
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    const res = await SELF.fetch("http://worker.local/proxy/deezer/search?q=queen");
    expect(res.status).toBe(502);
    expect(log).toHaveBeenCalledWith(expect.stringContaining("deezer fetch error path=search reason=network unreachable"));

    log.mockRestore();
  });
});
