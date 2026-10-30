/// <reference types="vitest/config" />
import { defineConfig, configDefaults } from 'vitest/config'
import { loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'
import { buildCsp } from './src/lib/csp.ts'

// Injects the production Content-Security-Policy <meta> tag into index.html.
// Build-only (`apply: 'build'`): dev keeps no CSP because Vite's HMR client
// needs an inline-script/eval-ish runtime a strict policy would break, and the
// dev server never serves real tenant data. `env` comes from `loadEnv` below,
// not `process.env` — Vite does not auto-load .env files into process.env.
function cspPlugin(env) {
  return {
    name: 'koios-csp',
    apply: 'build',
    transformIndexHtml(html) {
      const policy = buildCsp({
        VITE_API_URL: env.VITE_API_URL,
        VITE_WORKFLOW_API_URL: env.VITE_WORKFLOW_API_URL,
        VITE_CSRF_URL: env.VITE_CSRF_URL,
        VITE_MAP_TILE_URL: env.VITE_MAP_TILE_URL,
      })
      const tag = `<meta http-equiv="Content-Security-Policy" content="${policy}" />`
      // Insert right after the opening <head> tag (not before </head>): a
      // meta-delivered CSP only governs parsing from the point it appears, and
      // the entry <script type="module"> plus every modulepreload link follows
      // immediately in the built HTML — appending at </head> left the app's
      // own entry graph outside the policy.
      return html.replace(/<head>/, `<head>\n    ${tag}`)
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load .env / .env.production so the CSP plugin sees the real deploy hosts
  // even though they are not exported to process.env by default.
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  return {
    plugins: [react(), tailwindcss(), cspPlugin(env)],
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
    build: {
      rolldownOptions: {
        output: {
          // ONIX-RECHECK-1 #74: recharts and its redux/d3 dependencies form one `charts` chunk that
          // only the chart components import, instead of riding inside the EntityDrawer chunk that
          // index.html preloads on first paint (measured 28-10: 88 kB gzip of chart library on login).
          advancedChunks: {
            // Match the listed modules only: with the recursive default the group swallowed react-dom
            // (a recharts dependency) and the entry then preloaded the whole chunk again (measured 29-10).
            includeDependenciesRecursively: false,
            groups: [{
              name: 'charts',
              // Only recharts and its exclusive helpers: a shared library (d3-*, immer, fast-equals) in this group
              // would make the entry depend on the whole chunk again (measured 29-10: the charts chunk stayed in
              // index.html's modulepreload until the group was narrowed).
              test: /node_modules[\\/](recharts|victory-vendor|react-smooth|recharts-scale|decimal\.js-light)[\\/]/,
            }],
          },
        },
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: './src/test/setup.js',
      css: false,
      // vitest 5 clears every mock before each test by default; the suites were written against the vitest 2
      // behaviour (call history survives between tests unless a file clears it itself), so keep that contract.
      clearMocks: false,
      // Pin the relative API base the dev .env ships, so a checkout without that gitignored
      // file (CI, a fresh worktree) runs the suite exactly as every local gate does.
      env: { VITE_API_URL: '/api' },
      // The landing gates already give each test 15s (land.sh --testTimeout=15000); CI and manual runs get the
      // same budget, so a test that is merely slow on a loaded runner is not a red build (GitHub 24-10: 5027ms).
      testTimeout: 15000,
      // Agent worktrees under .claude/ carry their own stale copies of every suite;
      // they must never run against this checkout's src (09-09: 67 phantom failures).
      exclude: [...configDefaults.exclude, '.claude/**'],
    },
  }
})
