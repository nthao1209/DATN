import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/xe/',
  plugins: [react()],
  server: {
    cors: {
        origin: ['https://api.toolhub.app', 'https://build.toolhub.app'],
        methods: ['GET', 'POST'],
        allowedHeaders: ['Content-Type']
      },
    allowedHosts: ['toolhub.app'],
    port: 5173,
    strictPort: true,

    watch: {
      usePolling: true,
      interval: 1000,
      ignored: [
        '**/node_modules/**',
        '**/dist/**',
        '**/.git/**'
      ]
    },

    hmr: {
      protocol: 'ws',
      host: '127.0.0.1',
      clientPort: 5173,
      port: 5173
    }
  }
})