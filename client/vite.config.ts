/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { routesManifest } from './src/lib/seoRoutes';

function dropMockWorker(): Plugin {
  let outDir = 'dist';
  return {
    name: 'drop-mock-worker',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    async closeBundle() {
      await rm(join(outDir, 'mockServiceWorker.js'), { force: true });
    },
  };
}

function emitRoutesManifest(): Plugin {
  return {
    name: 'emit-routes-manifest',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'routes.json', source: `${JSON.stringify(routesManifest(), null, 2)}\n` });
    },
  };
}

export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react(), dropMockWorker(), emitRoutesManifest()],
  resolve: {
    alias: {
      '@onyx': fileURLToPath(new URL('../onyx-ui/src', import.meta.url)),
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
    dedupe: ['react', 'react-dom', 'clsx', 'tailwind-merge', 'react-icons'],
  },
  server: {
    port: 5175,
    proxy: {
      '/api': { target: process.env.VITE_API_TARGET ?? 'http://localhost:3000', changeOrigin: false },
    },
  },
  test: {
    environment: 'happy-dom',
    include: ['tests/**/*.test.{ts,tsx}'],
    setupFiles: ['tests/setup.ts'],
  },
});
