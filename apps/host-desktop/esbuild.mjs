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
