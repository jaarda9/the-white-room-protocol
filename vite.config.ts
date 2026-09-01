import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    allowedHosts: [".vercel.run"],
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Ensure service worker and manifest are copied to dist
    // Note: Vite automatically copies public folder contents to dist root
    // So sw.js and manifest.json will be at the root of dist
  },
  // Ensure public assets are properly served
  publicDir: 'public',
}));
