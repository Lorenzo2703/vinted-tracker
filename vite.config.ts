import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), VitePWA({
    registerType: 'prompt',
    includeAssets: ['app-icon.svg', 'icons/*.png'],
    manifest: {
      id: '/', name: 'Vinted Tracker', short_name: 'Vinted Tracker',
      description: 'Inventario, vendite e metriche del tuo guardaroba. Anche offline.',
      lang: 'it', theme_color: '#087f79', background_color: '#f5f8f8',
      display: 'standalone', start_url: '/', scope: '/',
      icons: [
        { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    workbox: { globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'], navigateFallback: 'index.html', clientsClaim: true },
  })],
})
