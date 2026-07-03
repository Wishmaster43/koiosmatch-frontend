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
