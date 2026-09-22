import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["apple-touch-icon.png"],
      // Only the app shell (JS/CSS/HTML/icons) is precached — API responses
      // are never cached, so the dashboard/portal always show live data.
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico}"],
        navigateFallbackDenylist: [/^\/api\//],
      },
      manifest: {
        id: "/",
        name: "Clazzo",
        short_name: "Clazzo",
        description: "Clazzo — the coaching marketplace and operator dashboard for institutes, teachers and students.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#f5ead8",
        theme_color: "#c67139",
        icons: [
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          { src: "maskable-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ],
});
