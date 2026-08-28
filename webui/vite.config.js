import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Build the SPA into webapp/spa/, served by FastAPI. Dev proxies /api to uvicorn.
export default defineConfig({
  plugins: [react()],
  base: "/",
  build: {
    outDir: "../webapp/spa",
    emptyOutDir: true,
  },
  server: {
    proxy: { "/api": "http://127.0.0.1:8760" },
  },
});
