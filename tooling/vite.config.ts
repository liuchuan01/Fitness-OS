import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const fromRoot = (path: string) => fileURLToPath(new URL(`../${path}`, import.meta.url));

export default defineConfig({
  root: fromRoot("."),
  publicDir: fromRoot("public"),
  envDir: fromRoot("."),
  plugins: [react()],
  build: {
    outDir: fromRoot("dist"),
    emptyOutDir: true,
    rollupOptions: {
      input: { app: fromRoot("index.html"), designLab: fromRoot("design-lab.html") },
      output: {
        manualChunks(id) {
          if (id.includes("/node_modules/react/") || id.includes("/node_modules/react-dom/")) {
            return "react-vendor";
          }
        }
      }
    }
  },
  server: {
    port: 5173,
    proxy: {
      "/api": process.env.FITNESS_API_ORIGIN ?? "http://127.0.0.1:8787"
    }
  }
});
