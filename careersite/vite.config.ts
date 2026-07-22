import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// Standalone public career site — its OWN Vite app inside the repo, entirely
// separate from the admin build. `root` is pinned to this directory because
// npm scripts invoke Vite from the repo root (its cwd), and Vite's default
// `root` is the process cwd, not the config file's folder.
const careersiteDir = fileURLToPath(new URL('.', import.meta.url))

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Reads careersite/.env(.local) so VITE_CAREER_BASE can configure `base` without
  // a shell export — this only affects the config itself; app code still reads
  // VITE_* via import.meta.env as usual.
  const env = loadEnv(mode, careersiteDir, 'VITE_')

  return {
    root: careersiteDir,
    // Configurable deploy path (e.g. a tenant-scoped subpath); '/' for a plain domain root.
    base: env.VITE_CAREER_BASE ?? '/',
    plugins: [react()],
    // Fixed dev port so the public site never collides with the admin app (:5173).
    server: { port: 5273 },
    // Same "@/" alias convention as the admin app (CLAUDE.md §11) — no deep relative chains.
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    build: {
      // Output next to the admin's `dist/`, never inside it.
      outDir: '../dist-careersite',
      emptyOutDir: true,
    },
    test: {
      root: careersiteDir,
      environment: 'jsdom',
      globals: false,
      css: false,
      setupFiles: './src/test/setup.ts',
    },
  }
})
