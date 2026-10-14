import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Portal Empresarial — consume el mismo backend Go que la app de turismo.
// En dev se proxean las rutas del backend para trabajar same-origin (igual que en prod vía nginx).
const BACKEND = process.env.BACKEND_URL || 'http://localhost:8081'
const proxied = ['/api', '/auth', '/static', '/assets/svg']

export default defineConfig({
  plugins: [react()],
  base: '/business/',
  server: {
    port: 5180,
    proxy: Object.fromEntries(proxied.map((p) => [p, { target: BACKEND, changeOrigin: true }])),
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
