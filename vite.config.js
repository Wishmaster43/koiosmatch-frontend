/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // "@/" resolves to src/ — no deep ../../../ chains (CLAUDE.md §11).
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  // Always run on 5173; fail loudly if it's taken instead of silently using 5174.
  // D1 same-origin proxy (cookie mode): the browser only ever talks to localhost, so the
  // Sanctum session cookie is FIRST-party (localhost ↔ .test is cross-site — browsers drop
  // the cookie, D1-DEV-1). Harmless in bearer mode: absolute API URLs bypass the proxy.
  server: {
    port: 5173, strictPort: true,
    // Poll for changes instead of relying on fs events (measured 25-07-2026): after a
    // long-running dev session with many file writes from outside the editor, the
    // native watcher silently stopped firing — the server kept serving the CACHED
    // transform of changed modules (same URL returned old code, only a cache-busting
    // query returned the new one), so the browser showed stale UI while the files on
    // disk were correct. Polling src/ costs little (node_modules is ignored) and makes
    // "I don't see my change" impossible.
    watch: { usePolling: true, interval: 400 },
    proxy: {
      '/api':     { target: 'http://koiosmatch-api.test', changeOrigin: true },
      '/sanctum': { target: 'http://koiosmatch-api.test', changeOrigin: true },
    },
  },
  // Use the automatic JSX runtime everywhere (incl. test files), so test JSX
  // doesn't need an explicit `import React`.
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
    css: false,
  },
})
