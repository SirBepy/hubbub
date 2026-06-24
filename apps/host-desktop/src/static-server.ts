import { createServer, type Server } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname, normalize, resolve, sep } from "node:path";

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
      const rawPath = req.url ?? "/";
      // Reject any request whose raw path contains a traversal segment before
      // the URL parser gets a chance to collapse it.
      if (/(?:^|[/\\])\.\.(?:[/\\]|$)/.test(decodeURIComponent(rawPath.split("?")[0]))) {
        res.writeHead(403, { "content-type": "text/plain" });
        res.end("Forbidden");
        return;
      }
      const url = new URL(rawPath, "http://localhost");
      let pathname = decodeURIComponent(url.pathname);
      if (pathname.endsWith("/")) pathname += "index.html";
      const safe = normalize(pathname)
        .replace(/^(\.\.[/\\])+/, "")
        .replace(/^[/\\]+/, "");
      let filePath = join(dir, safe);
      const root = resolve(dir);
      const resolved = resolve(filePath);
      if (resolved !== root && !resolved.startsWith(root + sep)) {
        res.writeHead(403, { "content-type": "text/plain" });
        res.end("Forbidden");
        return;
      }
      let ext = extname(filePath);
      let body: Buffer;
      try {
        body = await readFile(filePath);
      } catch {
        // Only fall back to index.html for top-level extension-less routes
        // (e.g. /lobby, /join). Paths with separators (e.g. etc/passwd) are
        // not SPA routes and must return 404, not silently serve index.html.
        if (ext === "" && !safe.includes(sep) && !safe.includes("/")) {
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
