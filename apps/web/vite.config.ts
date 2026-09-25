/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// Backend lokal: cd api && go run ./cmd/server (port 8080)
const apiProxy = { "/api": "http://localhost:8080" };

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // PWA (D-01, F-07): manifest statis di public/manifest.webmanifest,
    // service worker dibuat Workbox dengan precache cangkang aplikasi.
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: false,
      manifest: false,
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2,webmanifest}"],
        // Grafik (Recharts) besar dan hanya untuk halaman laporan: tidak di-precache,
        // di-cache saat pertama dibuka.
        globIgnores: ["**/TrendChart-*.js", "**/og-image.png"],
        navigateFallback: "/index.html",
        // Jangan pernah menyajikan index.html untuk API; data API tidak disimpan
        // service worker (data pribadi di-cache oleh aplikasi per pengguna).
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/assets/TrendChart-"),
            handler: "CacheFirst",
            options: { cacheName: "fundly-chunks", expiration: { maxEntries: 10 } },
          },
        ],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
      },
    }),
  ],
  server: { proxy: apiProxy },
  preview: { proxy: apiProxy },
  build: {
    target: "es2022",
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    css: false,
  },
});
