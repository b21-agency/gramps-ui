import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// GRAMPS_API_TARGET selects the backend for the dev proxy:
// local docker stack by default (see dev/README.md), or any Gramps Web instance URL
const target = process.env.GRAMPS_API_TARGET ?? 'http://localhost:5055'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  server: {
    port: 5173,
    proxy: { '/api': { target, changeOrigin: true, secure: true } },
  },
})
