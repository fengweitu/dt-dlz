import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The WhatsApp pool API is a Cloudflare Pages Function, so it only exists on
// the deployed site. Without this proxy /wh-admin would report "打不开号池"
// on every local run. Everything else still goes to the old local backend.
const WA_PROXY = process.env.WA_PROXY_TARGET || "https://www.tideoralab.com";
const API_PROXY = process.env.API_PROXY_TARGET || "http://127.0.0.1:8080";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // must be declared before "/api" so the more specific path wins
      "/api/wa": { target: WA_PROXY, changeOrigin: true },
      "/api": { target: API_PROXY, changeOrigin: false },
    },
  },
  preview: {
    proxy: {
      "/api/wa": { target: WA_PROXY, changeOrigin: true },
      "/api": { target: API_PROXY, changeOrigin: false },
    },
  },
});
