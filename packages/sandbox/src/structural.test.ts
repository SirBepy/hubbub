import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

/** The one module allowed to postMessage at `"*"`. Safe there because its payload is PlayerInfo
 * and because an opaque frame has no parseable targetOrigin to address instead. */
const BOOTSTRAP_MODULE = "packages/sandbox/src/shell.ts";
const THIS_FILE = "packages/sandbox/src/structural.test.ts";

const SKIP_DIRS = new Set(["node_modules", "dist", ".git", ".turbo", "coverage"]);
const SOURCE_EXT = /\.(ts|tsx|js|jsx|mjs)$/;
const COMMENT_LINE = /^\s*(\/\/|\*|\/\*)/;

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (SOURCE_EXT.test(entry)) out.push(full);
  }
  return out;
}

const FILES = ["apps", "packages"]
  .flatMap((d) => sourceFiles(join(repoRoot, d)))
  .map((f) => ({ rel: relative(repoRoot, f).replace(/\\/g, "/"), src: readFileSync(f, "utf8") }));

/** Prose about a rule is not a violation of it, and this file names both patterns to test them. */
function offenders(pattern: RegExp, allow: string[]): string[] {
  return FILES.filter(({ rel, src }) => {
    if (allow.includes(rel) || rel === THIS_FILE) return false;
    return src.split("\n").some((line) => pattern.test(line) && !COMMENT_LINE.test(line));
  }).map(({ rel }) => rel);
}

// Both argument orders a wildcard target can take: postMessage(msg, "*") and the transfer-list
// form postMessage(msg, "*", [port]).
const WILDCARD_POST = /postMessage\([^)]*["']\*["']/;

describe("S4: wildcard postMessage stays in the bootstrap module", () => {
  it("finds no other call site", () => {
    expect(offenders(WILDCARD_POST, [BOOTSTRAP_MODULE])).toEqual([]);
  });

  it("still sees the one legitimate call, so the pattern has not silently stopped matching", () => {
    const bootstrap = FILES.find((f) => f.rel === BOOTSTRAP_MODULE);
    expect(bootstrap?.src.split("\n").some((l) => WILDCARD_POST.test(l) && !COMMENT_LINE.test(l))).toBe(true);
  });
});

describe("S3: allow-same-origin never reaches an iframe", () => {
  it("appears in no source file outside prose", () => {
    expect(offenders(/allow-same-origin/, [])).toEqual([]);
  });
});
