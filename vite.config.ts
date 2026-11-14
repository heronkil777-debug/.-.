import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const apiPort = process.env.NEXO_API_PORT || '8765';
const apiTarget = `http://127.0.0.1:${apiPort}`;

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
        configure(proxy) {
          proxy.on('proxyReq', (proxyReq, req) => {
            // Browser code uses relative URLs. Only the dev proxy rewrites Origin
            // to the loopback API; the production server never enables this bypass.
            if (req.headers.origin) proxyReq.setHeader('Origin', apiTarget);
            if (process.env.NEXO_PREVIEW_PROXY_KEY) {
              proxyReq.setHeader('X-NEXO-Key', process.env.NEXO_PREVIEW_PROXY_KEY);
            }
          });
        },
      },
    },
  },
  preview: { host: '0.0.0.0', port: 4173, allowedHosts: true },
  build: { target: 'es2022' },
});
