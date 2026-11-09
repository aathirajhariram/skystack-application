import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev only: the browser calls /api/... and Vite forwards it to the customer API (same origin => cookies just work).
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { "/api": { target: "http://localhost:8000", changeOrigin: true, rewrite: (p) => p.replace(/^\/api/, "") } },
  },
});
