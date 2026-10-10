import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const proxy = {
  '/api': { target: 'http://localhost:8080', changeOrigin: true },
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const demoAuth = mode === 'development' && env.ASKPOOL_DEMO_AUTH !== 'false'
  const demoIdentityPlugin: Plugin = {
    name: 'askpool-demo-identity',
    configureServer(server) {
      server.middlewares.use('/api/me', (_request, response) => {
        response.setHeader('Content-Type', 'application/json; charset=utf-8')
        response.setHeader('Cache-Control', 'no-store')
        response.end(
          JSON.stringify({
            id: env.ASKPOOL_DEMO_USER_ID || 'alex@ethz.ch',
            name: env.ASKPOOL_DEMO_USER_NAME || 'Alex Morgan',
          }),
        )
      })
    },
  }
  return {
    plugins: [
      react(),
      tailwindcss(),
      ...(demoAuth ? [demoIdentityPlugin] : []),
    ],
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
              ...(demoAuth
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
