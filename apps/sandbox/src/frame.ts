import { awaitBootstrap } from "@hubbub/sdk/bridge";
import type { GameBundle } from "@hubbub/sdk/bridge";

/** Ids and content hashes only. The bundle URL is built from these, so anything outside this
 * set - a slash, a dot segment, a scheme - must never reach it. */
const SAFE_SEGMENT = /^[a-zA-Z0-9._-]{1,64}$/;

class FrameError extends Error {}

// The port is established BEFORE the bundle is fetched, so every failure below has somewhere to
// go. Painting into this document instead would put a second error surface on the TV, competing
// with the shell's own and visible for however long the shell's ready-timeout takes to fire.
const { port, role } = await awaitBootstrap();

try {
  const params = new URLSearchParams(location.search);
  const gameId = params.get("game") ?? "";
  const version = params.get("v") ?? "";
  if (!SAFE_SEGMENT.test(gameId) || !SAFE_SEGMENT.test(version)) throw new FrameError("Unrecognised game.");

  const root = document.getElementById("root");
  if (!root) throw new FrameError("The game frame is missing its root element.");

  // Same-origin by construction: the bundle lives on the sandbox origin this document was served
  // from, so `script-src 'self'` covers it and no author-controlled host is ever contacted.
  const bundleUrl = new URL(`./games/${gameId}/${version}.js`, location.href).href;
  const mod = await import(/* @vite-ignore */ bundleUrl).catch(() => {
    throw new FrameError("This game could not be loaded.");
  });

  const bundle = (mod as { default?: GameBundle }).default;
  if (!bundle || typeof bundle.attach !== "function") throw new FrameError("This game is not a valid Hubbub bundle.");

  bundle.attach({ root, port, role });
} catch (err) {
  // Deliberately not the caught message when it is not ours: an exception thrown from inside an
  // untrusted bundle is author-controlled text, and the shell renders nothing it is handed anyway.
  port.postMessage({ t: "error", message: err instanceof FrameError ? err.message : "This game failed to start." });
}
