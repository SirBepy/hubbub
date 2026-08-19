import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    passWithNoTests: true,
    pool: "forks",
    fileParallelism: false,
    maxConcurrency: 5,
    // apps/worker runs on @cloudflare/vitest-pool-workers via its own `pnpm test:worker`
    // (root "test" script), so it stays excluded here.
    // Root vitest bumped 2.x -> ^4.1.0 on 2026-08-19 (todo 57, cleared critical
    // GHSA-5xrq-8626-4rwp) to match apps/worker's own vitest-pool-workers peer range.
    exclude: ["**/node_modules/**", "**/dist/**", "apps/worker/**"],
  },
});
