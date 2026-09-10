import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: "0.0.0.0",
    port: 3000,
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom"],
  },
  optimizeDeps: {
    include: ["react", "react-dom"],
  },
  build: {
    // Ensure service worker and manifest are copied to dist
    // Note: Vite automatically copies public folder contents to dist root
    // So sw.js and manifest.json will be at the root of dist
  },
  // Ensure public assets are properly served
  publicDir: 'public',
});
