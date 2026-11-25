import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

const pages = {
  name: 'proxyspring-pages',
  configureServer(server: {middlewares: {use: (fn: (req: {url?: string; method?: string}, res: unknown, next: () => void) => void) => void}}) {
    server.middlewares.use((req, _res, next) => {
      const path = (req.url || '').split('?')[0];
      if (req.method === 'GET' && /^\/(check|privacy)\/?$/.test(path)) req.url = '/index.html';
      next();
    });
  },
};

export default defineConfig({
  root: 'web',
  plugins: [react(), pages],
  build: {outDir: '../dist/web', emptyOutDir: true},
  server: {host: '127.0.0.1', port: Number(process.env.PORT || 8081)},
});
