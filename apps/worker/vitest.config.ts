import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

// vitest-pool-workers 0.20.2 (vitest 4) moved config from a defineWorkersConfig helper to this
// plugin form - no "./config" export subpath exists on this version.
export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.jsonc" },
    }),
  ],
});
