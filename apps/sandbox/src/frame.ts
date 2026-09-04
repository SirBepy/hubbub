import { awaitBootstrap } from "@hubbub/sdk/bridge";
import type { GameBundle } from "@hubbub/sdk/bridge";

/** Ids and content hashes only. The bundle URL is built from these, so anything outside this
 * set - a slash, a dot segment, a scheme - must never reach it. */
const SAFE_SEGMENT = /^[a-zA-Z0-9._-]{1,64}$/;

function fail(message: string): never {
  const el = document.getElementById("error");
  if (el) {
    el.textContent = message;
    el.style.display = "block";
  }
  throw new Error(message);
}

const params = new URLSearchParams(location.search);
const gameId = params.get("game") ?? "";
const version = params.get("v") ?? "";
if (!SAFE_SEGMENT.test(gameId) || !SAFE_SEGMENT.test(version)) fail("This game could not be identified.");

const root = document.getElementById("root") ?? fail("The game frame is missing its root element.");

// Same-origin by construction: the bundle lives on the sandbox origin this document was served
// from, so `script-src 'self'` covers it and no author-controlled host is ever contacted.
const bundleUrl = new URL(`./games/${gameId}/${version}.js`, location.href).href;

const [bootstrap, mod] = await Promise.all([
  awaitBootstrap(),
  import(/* @vite-ignore */ bundleUrl).catch(() => fail("This game could not be loaded.")),
]);

const bundle = (mod as { default?: GameBundle }).default;
if (!bundle || typeof bundle.attach !== "function") fail("This game is not a valid Hubbub bundle.");

bundle.attach({ root, port: bootstrap.port, role: bootstrap.role });
