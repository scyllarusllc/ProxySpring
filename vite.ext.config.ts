import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'extension',
  base: './',
  publicDir: 'public',
  plugins: [react()],
  build: {
    outDir: '../dist/extension',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        app: 'app.html',
        background: 'src/background.ts',
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
});
