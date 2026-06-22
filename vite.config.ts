/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

export default defineConfig(({ mode, command, isPreview }) => ({
  // GitHub Pages serves this project site under a subpath
  // (https://elliewlh2094.github.io/behavior-tree-visualization-tool/). Use the
  // subpath base for `vite build` AND `vite preview` (isPreview) — preview
  // serves the built assets, which reference the subpath, so its base must
  // match the build or every asset 404s to the SPA fallback (text/html). Only
  // `vite dev` (command='serve' && !isPreview) stays at '/' for convenience.
  // PWA start_url / scope ('.') and workbox.navigateFallback ('index.html') are
  // relative, so they resolve correctly under the subpath unchanged (AD7).
  base: command === 'build' || isPreview ? '/behavior-tree-visualization-tool/' : '/',
  plugins: [
    react(),
    VitePWA({
      // `npm run preview:dev` builds with --mode no-pwa to skip the service
      // worker, avoiding stale-cache surprises at localhost:4173 (B3).
      disable: mode === 'no-pwa',
      registerType: 'autoUpdate',
      // Precache the brand logos. They live in public/ and are referenced only
      // by runtime `src="/icon.svg"` strings, so the bundler never sees them and
      // the default precache globs miss them — leaving a broken logo offline or
      // after the SW takes over (FB-NEW1 root cause).
      includeAssets: ['icon.svg', 'icon-dark.svg'],
      manifest: {
        name: 'Behavior Tree Visualizer',
        short_name: 'BT Visualizer',
        description: 'Offline-first authoring, visualization, and validation for behavior trees.',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        orientation: 'any',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: 'index.html',
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/core/**/*.ts'],
      reporter: ['text', 'html'],
    },
  },
}));
