import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    passWithNoTests: true,
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
    maxConcurrency: 5,
  },
});
