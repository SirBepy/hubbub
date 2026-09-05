#!/usr/bin/env node
// Flips the local dev loop between the fast direct-import path and the real iframe + MessageChannel
// path a published game actually runs through. Without the second one, the loop tests something
// structurally different from what ships and structured-clone bugs surface in production.
import { existsSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const marker = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", ".sandbox");
const mode = process.argv[2];

if (mode === "on") writeFileSync(marker, "");
else if (mode === "off") rmSync(marker, { force: true });
else {
  console.error("usage: sandbox-mode.mjs on|off");
  process.exit(1);
}

console.log(
  existsSync(marker)
    ? "sandbox mode ON - games run in the cross-origin frame. Needs `pnpm build` in each game repo."
    : "sandbox mode OFF - games load directly from the workspace (fast loop).",
);
