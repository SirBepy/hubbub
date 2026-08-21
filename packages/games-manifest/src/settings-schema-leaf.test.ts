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

// settings.ts is generated from whichever sibling repos are on disk, so a bare "at least one"
// canary goes red on a solo checkout. Derive the expected set instead: every declared game
// package that resolves a "/settings" subpath here must appear in settings.ts.
const manifestPkg = require("../package.json");
const declaredGamePackages = [
  ...Object.keys(manifestPkg.dependencies ?? {}),
  ...Object.keys(manifestPkg.optionalDependencies ?? {}),
].filter((name) => name.startsWith("@hubbub/game-"));
const expectedGamePackages = declaredGamePackages.filter((name) => {
  try {
    require.resolve(`${name}/settings`);
    return true;
  } catch {
    return false;
  }
});

describe("game settings-schema.ts stays an import leaf", () => {
  it("settings.ts registers every present game that ships a settings schema", () => {
    expect([...gamePackages].sort()).toEqual([...expectedGamePackages].sort());
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
