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
