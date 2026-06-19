/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Always run on 5173; fail loudly if it's taken instead of silently using 5174.
  server: { port: 5173, strictPort: true },
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
