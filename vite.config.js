/// <reference types="vitest/config" />
import { defineConfig, configDefaults } from 'vitest/config'
import { loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { buildCsp } from './src/lib/csp'

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
    plugins: [react(), cspPlugin(env)],
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
      // Agent worktrees under .claude/ carry their own stale copies of every suite;
      // they must never run against this checkout's src (09-09: 67 phantom failures).
      exclude: [...configDefaults.exclude, '.claude/**'],
    },
  }
})
