import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const proxy = {
  '/api/questions': { target: 'http://127.0.0.1:3001', changeOrigin: true },
  '/api': { target: 'http://localhost:8080', changeOrigin: true },
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), tailwindcss()],
    resolve: { dedupe: ['react', 'react-dom'] },
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        ...Object.fromEntries(
          Object.entries(proxy).map(([path, config]) => [
            path,
            {
              ...config,
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
          ]),
        ),
      },
    },
    preview: { port: 4173, strictPort: true, proxy },
  }
})
