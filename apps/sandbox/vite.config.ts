import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
import { DEFAULT_RELAY_ORIGIN, DEFAULT_SHELL_ORIGIN, selectBundles, sandboxHeadersFile } from "./build-assets";
// Relative, not by package name: the config is bundled by esbuild, which externalises bare
// specifiers, and these workspace packages ship raw TypeScript with no dist for Node to load.
import { BUNDLE_HEADERS, FRAME_SECURITY_HEADERS, frameCsp } from "../../packages/sandbox/src/csp";
import { GAME_BUNDLE_PATHS } from "../../packages/games-manifest/src/sources";
import { gameRepoFsAllow } from "../../vite.game-repos";

const PORT = 5176;
const SHELL_ORIGIN = process.env.HUBBUB_SHELL_ORIGIN ?? DEFAULT_SHELL_ORIGIN;
const RELAY_ORIGIN = process.env.HUBBUB_RELAY_ORIGIN ?? DEFAULT_RELAY_ORIGIN;

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

/** Completes `dist/` into a deployable static origin: the games' bundles at the URL the shell
 * asks for, plus the `_headers` file that carries the CSP and CORS the dev server sets in code.
 * Bundles are copied from the sibling repos' own builds, so those must be built first. */
function productionAssets(): Plugin {
  let outDir = "";
  // A deploy sets both origins; CI's plain `pnpm build` sets neither and has no sibling game
  // repos checked out, so it legitimately finds nothing to copy and must still pass.
  const deployShaped = () => !!process.env.HUBBUB_SHELL_ORIGIN && !!process.env.HUBBUB_RELAY_ORIGIN;
  return {
    name: "hubbub-production-assets",
    apply: "build",
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
      if (!deployShaped()) {
        config.logger.warn(
          `\n[hubbub-sandbox] HUBBUB_SHELL_ORIGIN / HUBBUB_RELAY_ORIGIN not both set: building a CSP for ` +
            `${SHELL_ORIGIN} / ${RELAY_ORIGIN}. Fine for a local check, never deploy this output.\n`,
        );
      }
    },
    writeBundle() {
      const { found, missing } = selectBundles(GAME_BUNDLE_PATHS, existsSync);
      if (found.length === 0) {
        const msg = "No game bundles found. Build each game repo first (`pnpm build` in it).";
        // An origin that serves no games is a deploy that looks healthy and plays nothing.
        if (deployShaped()) throw new Error(msg);
        console.warn(`[hubbub-sandbox] ${msg}`);
      }
      for (const id of missing) console.warn(`[hubbub-sandbox] no built bundle for "${id}", skipped`);
      for (const { src, dest } of found) {
        mkdirSync(dirname(resolve(outDir, dest)), { recursive: true });
        copyFileSync(src, resolve(outDir, dest));
      }
      writeFileSync(
        resolve(outDir, "_headers"),
        sandboxHeadersFile({ shellOrigin: SHELL_ORIGIN, relayOrigin: RELAY_ORIGIN }),
      );
    },
  };
}

export default defineConfig({
  plugins: [devBundleRoute(), productionAssets()],
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
