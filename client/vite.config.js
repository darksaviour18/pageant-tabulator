import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Pageant Tabulator Pro',
        short_name: 'PageantPro',
        description: 'Local-first pageantry scoring system',
        theme_color: '#0f172a',
        background_color: '#f8fafc',
        display: 'standalone',
        start_url: '/',
        // Placeholder icons — replace with actual 192x192 and 512x512 PNGs before production
        icons: [
          {
            src: '/icon.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
      },
      workbox: {
        // Precache static assets only (no API caching yet)
        globPatterns: ['**/*.{js,css,html,ico,svg,png}'],
        navigateFallback: undefined,
        runtimeCaching: [],
      },
      devOptions: {
        enabled: false, // Disable SW in dev to avoid caching during active development
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
