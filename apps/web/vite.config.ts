import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { gameRepoFsAllow } from "../../vite.game-repos";

export default defineConfig({
  plugins: [react()],
  // Same shadow-build risk as apps/screen/apps/controller's own vite.config.ts, now for the
  // two reused app packages too: exclude so esbuild's crawler never pre-bundles a stale copy.
  optimizeDeps: { exclude: ["@hubbub/ui", "@hubbub/screen", "@hubbub/controller"] },
  server: { host: true, port: 5175, fs: { allow: gameRepoFsAllow() } }, // host:true exposes on LAN
});
