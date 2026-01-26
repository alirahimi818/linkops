import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "assets/favicon/favicon.ico",
        "assets/favicon/apple-touch-icon.png",
        "assets/favicon/favicon.svg",
        "assets/favicon/favicon-96x96.png",
      ],
      manifest: {
        name: "togetherForIran",
        short_name: "togetherForIran",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#ffffff",
        orientation: "portrait",
        icons: [
          {
            src: "/assets/favicon/web-app-manifest-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable",
          },
          {
            src: "/assets/favicon/web-app-manifest-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        // SPA fallback for routes like /todos, /admin, ...
        navigateFallback: "/index.html",
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webmanifest}"],
      },
    }),
  ],
});
