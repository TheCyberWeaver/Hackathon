import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const proxy = {
  '/api': { target: 'http://127.0.0.1:3001', changeOrigin: true },
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { host: true, port: 5174, strictPort: true, proxy },
  preview: { host: true, port: 4174, strictPort: true, proxy },
})
