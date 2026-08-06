import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    passWithNoTests: true,
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
    maxConcurrency: 5,
    // apps/worker runs on @cloudflare/vitest-pool-workers, which requires vitest 4 - this repo
    // pins vitest 2 at the root, so that package tests via its own `pnpm test:worker` instead
    // (wired into the root "test" script; see package.json).
    exclude: ["**/node_modules/**", "**/dist/**", "apps/worker/**"],
  },
});
