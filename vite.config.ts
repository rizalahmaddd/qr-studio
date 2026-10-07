import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  build: { target: 'es2020', sourcemap: false },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.svg', 'favicon.ico', 'apple-touch-icon.png', 'theme-init.js', 'og.png'],
      manifest: {
        id: '/',
        name: 'QR Studio — Pembuat Kode QR',
        short_name: 'QR Studio',
        description: 'Buat dan pindai kode QR. Gratis, tanpa login, bisa dipakai offline.',
        lang: 'id',
        dir: 'ltr',
        start_url: '/#buat',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#f4f3ee',
        theme_color: '#0b6e4f',
        categories: ['utilities', 'productivity'],
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Buat kode QR', short_name: 'Buat', url: '/#buat', icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }] },
          { name: 'Pindai kode QR', short_name: 'Pindai', url: '/#pindai', icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }] },
          { name: 'QR WiFi', short_name: 'WiFi', url: '/?jenis=wifi#buat', icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }] },
        ],
        share_target: {
          action: '/',
          method: 'GET',
          enctype: 'application/x-www-form-urlencoded',
          params: { title: 'title', text: 'text', url: 'url' },
        },
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2,webmanifest}'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
});
