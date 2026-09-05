import { existsSync, readFileSync } from "node:fs";
import { defineConfig, type Plugin } from "vite";
// Relative, not by package name: the config is bundled by esbuild, which externalises bare
// specifiers, and these workspace packages ship raw TypeScript with no dist for Node to load.
import { BUNDLE_HEADERS, FRAME_SECURITY_HEADERS, frameCsp } from "../../packages/sandbox/src/csp";
import { GAME_BUNDLE_PATHS } from "../../packages/games-manifest/src/sources";
import { gameRepoFsAllow } from "../../vite.game-repos";

const PORT = 5176;
const SHELL_ORIGIN = process.env.HUBBUB_SHELL_ORIGIN ?? "http://localhost:5175";
const RELAY_ORIGIN = process.env.HUBBUB_RELAY_ORIGIN ?? "http://localhost:7787";

const BUNDLE_ROUTE = /^\/games\/([a-zA-Z0-9._-]{1,64})\/[a-zA-Z0-9._-]{1,64}\.js$/;

/** Serves a game's own `dist/bundle.js` off disk at the same URL shape the cloud origin serves
 * from KV. The version segment is ignored here on purpose: a local author rebuilds constantly
 * and has no content hash to quote, but every other part of the path - the iframe, the port
 * handshake, the CSP, the opaque origin - is the real one. */
function devBundleRoute(): Plugin {
  return {
    name: "hubbub-dev-bundles",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const match = req.url ? BUNDLE_ROUTE.exec(req.url.split("?")[0]!) : null;
        if (!match) return next();
        const file = GAME_BUNDLE_PATHS[match[1]!];
        if (!file || !existsSync(file)) {
          res.statusCode = 404;
          res.end(`No built bundle for "${match[1]}". Run \`pnpm build\` in that game's repo.`);
          return;
        }
        for (const [k, v] of Object.entries(BUNDLE_HEADERS)) res.setHeader(k, v);
        res.setHeader("Cache-Control", "no-store"); // rebuilt constantly in dev, unlike a hashed key
        res.end(readFileSync(file));
      });
    },
  };
}

export default defineConfig({
  plugins: [devBundleRoute()],
  server: {
    host: true,
    port: PORT,
    cors: true, // the frame is opaque-origin, so even its own module fetches are CORS requests
    fs: { allow: gameRepoFsAllow() },
    headers: {
      ...FRAME_SECURITY_HEADERS,
      "Content-Security-Policy": frameCsp({
        shellOrigin: SHELL_ORIGIN,
        // Vite's HMR socket is the only dev-only addition; everything else matches production.
        connectOrigins: [RELAY_ORIGIN, RELAY_ORIGIN.replace(/^http/, "ws"), `ws://localhost:${PORT}`],
      }),
    },
  },
  build: { rollupOptions: { input: "frame.html" } },
});
