import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const proxy = {
  '/api': { target: 'http://localhost:8080', changeOrigin: true },
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': {
          ...proxy['/api'],
          // Local preview only. Production and `vite preview` require real proxy headers.
          ...(mode === 'development' && env.ASKPOOL_DEMO_AUTH !== 'false'
            ? {
                headers: {
                  'X-User-Id': env.ASKPOOL_DEMO_USER_ID || 'alex@ethz.ch',
                  'X-User-Name': encodeURIComponent(
                    env.ASKPOOL_DEMO_USER_NAME || 'Alex Morgan',
                  ),
                },
              }
            : {}),
        },
      },
    },
    preview: { port: 4173, strictPort: true, proxy },
  }
})
