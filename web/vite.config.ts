import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

const engine = fileURLToPath(new URL('../backend/src/modules/promotions/engine', import.meta.url));

export default defineConfig(({ mode }) => ({
  // Sub-folder the site is served from (VITE_BASE_PATH in .env files or the shell).
  base: loadEnv(mode, process.cwd(), 'VITE_').VITE_BASE_PATH || '/',
  plugins: [react()],
  resolve: {
    // The website and the API share one offers / festival engine (plain TypeScript).
    alias: { '@engine': engine },
  },
  server: { port: 5173, fs: { allow: ['..'] } },
  build: {
    target: 'es2020',
    sourcemap: true,
    rollupOptions: {
      output: { manualChunks: { react: ['react', 'react-dom', 'react-router-dom'] } },
    },
  },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
}));
