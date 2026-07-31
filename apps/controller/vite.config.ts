import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      // @fontsource/big-shoulders-display's exports map lacks the "./*.css" entry inter has,
      // so "@fontsource/big-shoulders-display/700.css" mis-resolves through pnpm; point at the
      // real file directly (via the workspace symlink, so it survives version bumps).
      {
        find: "@fontsource/big-shoulders-display/700.css",
        replacement: fileURLToPath(
          new URL("../../packages/ui/node_modules/@fontsource/big-shoulders-display/700.css", import.meta.url),
        ),
      },
    ],
  },
  server: { host: true, port: 5174 },
});
