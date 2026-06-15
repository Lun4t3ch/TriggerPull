import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// During local dev, proxy /api/* to the Wrangler Pages Functions server so the
// SSI login/scrape flow works without CORS headaches. When deployed to
// Cloudflare Pages, /functions/api/* is served on the same origin automatically.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8788',
        changeOrigin: true,
      },
    },
  },
});
