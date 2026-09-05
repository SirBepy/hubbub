import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { gameRepoFsAllow } from "../../vite.game-repos";
import { sandboxDefines } from "../../vite.sandbox-mode";

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  define: sandboxDefines(mode),
  // Workspace package: pre-bundling it lets esbuild's crawler resolve @hubbub/ui through
  // whichever node_modules copy it meets first (a sibling game repo's stale install, seen
  // in practice), caching that shadow build instead of this repo's live packages/ui source.
  optimizeDeps: { exclude: ["@hubbub/ui"] },
  server: { host: true, port: 5174, fs: { allow: gameRepoFsAllow() } },
}));
