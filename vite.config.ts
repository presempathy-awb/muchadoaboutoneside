import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  build: {
    manifest: true,
    rolldownOptions: {
      input: {
        site: fileURLToPath(new URL("./index.html", import.meta.url)),
        calligraphy: fileURLToPath(new URL("./cockpit.html", import.meta.url)),
      },
    },
  },
  // Keep the exact print-mesh adapter out of archival-only worker requests.
  worker: { format: "es" },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    // ws lets the poem editor's live-sync sockets reach Elysia in development.
    proxy: { "/api": { target: "http://127.0.0.1:3001", ws: true } },
  },
});
