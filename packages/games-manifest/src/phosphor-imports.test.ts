import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === "node_modules" || entry.name === "dist") return [];
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

// The package root re-exports ~3000 icon modules. Under vitest that one import cost 8s per test
// file normally and over 60s on a loaded machine, enough to time out whole-App render tests.
describe("phosphor icon imports", () => {
  it("import each icon from its own module, never the package root", () => {
    const offenders = ["apps", "packages"]
      .flatMap((dir) => sourceFiles(join(repoRoot, dir)))
      .filter((file) => /from\s+["']@phosphor-icons\/react["']/.test(readFileSync(file, "utf8")))
      .map((file) => file.slice(repoRoot.length).replace(/\\/g, "/"));
    expect(offenders).toEqual([]);
  });
});
