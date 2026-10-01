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
      // (SVG was dropped from the glob: it only ever matched unrelated icon
      // font files that added ~1.7 MB to every install.)
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,ico,woff2}"],
        navigateFallbackDenylist: [/^\/api\//],
        // Web fonts come from Google: cache them after first load so the app
        // keeps its typography offline instead of falling back to system fonts.
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "StaleWhileRevalidate",
            options: { cacheName: "google-fonts-styles" },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-files",
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      manifest: {
        id: "/",
        name: "Clazzo",
        short_name: "Clazzo",
        description: "Clazzo — attendance, fees and a student/parent portal for schools, colleges, coaching centres and tutors.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#f5ead8",
        theme_color: "#c67139",
        icons: [
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          { src: "maskable-192x192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
          { src: "maskable-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
        // Long-press the installed icon to jump straight to the common jobs.
        shortcuts: [
          { name: "Today's classes", short_name: "Today", url: "/dashboard", icons: [{ src: "pwa-192x192.png", sizes: "192x192" }] },
          { name: "Students", short_name: "Students", url: "/dashboard/students", icons: [{ src: "pwa-192x192.png", sizes: "192x192" }] },
        ],
        screenshots: [
          { src: "screenshots/dashboard-wide.png", sizes: "1280x720", type: "image/png", form_factor: "wide", label: "Dashboard" },
          { src: "screenshots/attendance-narrow.png", sizes: "540x960", type: "image/png", form_factor: "narrow", label: "Marking attendance" },
        ],
      },
    }),
  ],
});
