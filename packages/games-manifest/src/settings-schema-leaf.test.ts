import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);

// settings.ts is bundled EAGERLY into every browser app's initial chunk (unlike logics.ts/lazy.ts),
// so every registered game's settings-schema.ts must be an import leaf. Parses settings.ts's own
// imports instead of a hand-maintained list, so a newly-registered game is covered automatically.
const settingsSrcPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "settings.ts");
const settingsSrc = readFileSync(settingsSrcPath, "utf8");
const gamePackages = [...settingsSrc.matchAll(/from "(@hubbub\/game-[^"]+)\/settings"/g)].map((m) => m[1]);

const ALLOWED_SPECIFIERS = new Set(["@hubbub/sdk"]);

describe("game settings-schema.ts stays an import leaf", () => {
  it("found at least one registered game settings schema to check", () => {
    expect(gamePackages.length).toBeGreaterThan(0);
  });

  for (const pkg of gamePackages) {
    it(`${pkg}: settings-schema.ts imports stay inside the allowlist`, () => {
      const schemaPath = require.resolve(`${pkg}/settings`);
      const src = readFileSync(schemaPath, "utf8");
      const specifiers = [...src.matchAll(/^\s*import\s[^;]*?\sfrom\s+["']([^"']+)["']/gm)].map((m) => m[1]);
      for (const spec of specifiers) {
        expect(ALLOWED_SPECIFIERS.has(spec), `${pkg}/settings-schema.ts imports "${spec}", not on the allowlist`).toBe(
          true,
        );
      }
    });
  }
});
