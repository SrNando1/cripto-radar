import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Proxy para a CoinGecko: evita o bloqueio de CORS em dev.
    // Em produção (Vercel) o mesmo caminho é reescrito via vercel.json.
    proxy: {
      '/api/cg': {
        target: 'https://api.coingecko.com/api/v3',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/cg/, ''),
      },
    },
  },
})
