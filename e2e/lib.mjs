/**
 * e2e/lib — shared harness for the smoke suite: boots a logged-in page against the
 * REAL app + API (cookie auth — the only mode, H3), and collects console/page/
 * network errors per flow.
 * The suite exists because unit tests on both sides stay green while the seam breaks
 * (2026-07-03 audit): these flows click the actual product before Danny does.
 * Dev-tool only — never bundled with the app.
 */
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// audit frontend-security-quality-8: no credential literal lives in the repo. Values come
// from the environment, else from the untracked e2e/.env.local (KEY=VALUE lines, covered
// by the .env.* gitignore rule); a missing credential fails fast with a clear message.
const localEnv = (() => {
  try {
    const file = join(dirname(fileURLToPath(import.meta.url)), '.env.local')
    return Object.fromEntries(readFileSync(file, 'utf8').split('\n')
      .map(l => l.trim()).filter(l => l && !l.startsWith('#'))
      .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }))
  } catch { return {} }
})()
// An empty exported variable counts as unset, so the local file can still fill it in.
const env = (key) => process.env[key] || localEnv[key]
const required = (key) => {
  const v = env(key)
  if (!v) throw new Error(`[e2e] ${key} is not set — export it or put it in e2e/.env.local (untracked)`)
  return v
}

export const API = env('SMOKE_API') ?? 'http://koiosmatch-api.test/api'
export const APP = env('SMOKE_APP') ?? 'http://localhost:5173'
export const CREDS = { email: required('SMOKE_EMAIL'), password: required('SMOKE_PASSWORD') }
// The seeded MFA demo user the mfa flow logs in as (demo tenant); same source, same rule.
export const MFA_USER = { email: env('SMOKE_MFA_EMAIL') ?? 'sara@demo.nl', password: required('SMOKE_MFA_PASSWORD') }

// One booted context: browser + page with auth seeded and error collectors attached.
// Cookie-only (H3, 2026-07-08): the Bearer flow was removed from the app, so the
// suite ALWAYS logs in through the REAL UI form — there is no token in JS to seed.
export async function boot({ tenant = 'demo' } = {}) {
  const browser = await chromium.launch()
  const page = await browser.newPage()
  trackInflight(page)
  const errors = []
  // OPTIONAL endpoints (app has a seed fallback + calls them with quiet404): a 404 here
  // is the agreed "backend hasn't shipped this lookup yet" state, not a finding. Remove
  // an entry the moment the backend delivers it — then a 404 is a regression again.
  // (outreach-outcomes shipped 2026-07-04 → removed; list is empty right now.)
  const OPTIONAL_404 = []
  const isOptional404 = (text) => OPTIONAL_404.some(re => re.test(text)) && /404/.test(text)
  page.on('pageerror', e => errors.push(`[pageerror] ${String(e).slice(0, 250)}`))
  page.on('console', m => {
    if (m.type() !== 'error') return
    const text = m.text().slice(0, 250)
    if (isOptional404(text) || (OPTIONAL_404.some(re => re.test(m.location()?.url ?? '')) )) return
    // Chrome's bare network line ("Failed to load resource … 404") carries the url in location.
    if (/Failed to load resource/.test(text) && OPTIONAL_404.some(re => re.test(m.location()?.url ?? ''))) return
    errors.push(`[console] ${text}`)
  })
  page.on('response', async r => {
    if (r.status() >= 400) {
      if (r.status() === 404 && OPTIONAL_404.some(re => re.test(r.url()))) return
      // Deliberate harness probes (naad-contract's per_page ladder) tag themselves —
      // their expected 4xx must never bleed into ANOTHER flow's error window (the
      // response event can trail past the between-flows reset; measured 05-08).
      if (r.url().includes('_probe=1')) return
      // Include the response body — a bare "422" hides WHICH rule failed (the whole point).
      let body = ''
      try { body = (await r.text()).slice(0, 200) } catch { /* stream may be gone */ }
      errors.push(`[http ${r.status()}] ${r.request().method()} ${r.url().split('/api/')[1] ?? r.url()} ${body}`)
    }
  })

  // Log in through the real UI form; pre-seed only the (non-credential) tenant choice.
  await page.addInitScript(t => localStorage.setItem('active_tenant', t), tenant)
  await page.goto(`${APP}/`, { waitUntil: 'networkidle' })
  await page.fill('#login-email', CREDS.email)
  await page.fill('input[type="password"]', CREDS.password)
  await page.click('button[type="submit"]')
  // Logged in = the sidebar nav is attached and the first API burst has settled.
  await page.locator('button', { hasText: /^\s*Dashboard\s*$/ }).first().waitFor({ state: 'attached', timeout: 20000 })
  await quiet(page)
  // D1/H3 guard: no credential may ever appear in localStorage.
  const token = await page.evaluate(() => localStorage.getItem('auth_token'))
  if (token) errors.push('[d1] auth_token staat in localStorage — het Bearer-pad is gesloopt, dit mag NOOIT!')
  return { browser, page, errors }
}

// Poll an async predicate until truthy (returns its value) or throw a label-named timeout.
export async function until(fn, { timeout = 10000, interval = 200, label = 'condition' } = {}) {
  const end = Date.now() + timeout
  let lastErr = null
  for (;;) {
    try { const v = await fn(); if (v) return v } catch (e) { lastErr = e }
    if (Date.now() >= end) throw new Error(`[e2e] timed out after ${timeout}ms waiting for ${label}${lastErr ? `: ${lastErr.message}` : ''}`)
    await sleep(interval)
  }
}

// In-flight API request counter per page: a SPA re-renders after its fetches land, so
// "no API request pending for a moment" is the real settle signal (Playwright's own
// networkidle only fires once per document, which is useless for client-side routing).
const inflight = new WeakMap()
export function trackInflight(page) {
  if (inflight.has(page)) return inflight.get(page)
  const state = { n: 0 }
  inflight.set(page, state)
  const isApi = (r) => r.url().includes('/api/')
  page.on('request', r => { if (isApi(r)) state.n++ })
  const done = (r) => { if (isApi(r)) state.n = Math.max(0, state.n - 1) }
  page.on('requestfinished', done)
  page.on('requestfailed', done)
  return state
}

// Wait until no API request has been pending for `quietMs`; capped, never throws (a polling page must not fail a flow).
export async function quiet(page, { quietMs = 300, timeout = 8000 } = {}) {
  const state = trackInflight(page)
  let idleSince = null
  await until(() => {
    if (state.n > 0) { idleSince = null; return false }
    idleSince ??= Date.now()
    return Date.now() - idleSince >= quietMs
  }, { timeout, interval: 100, label: 'API quiet' }).catch(() => {})
}

// What a nav page renders once mounted: a heading, a table, a board card or the flow canvas.
const PAGE_CONTENT = 'h1, h2, table, [role="grid"], .react-flow, [draggable="true"]'

// Navigate via the sidebar (hash boot is flaky headless; the sidebar is the real UX path).
// Match the exact BUTTON text — the old `text=` substring matcher could hit page content
// (e.g. a heading or settings row) and then fail on "element intercepts pointer events".
// Waits for the page content to attach and the list fetches to settle, not for a fixed time.
export async function go(page, navLabel) {
  // A mid-flight navigation destroys the evaluate context; read it as unknown and let the poll retry.
  const where = () => page.evaluate(() => location.pathname + location.hash).catch(() => null)
  const before = await where()
  await page.locator('button', { hasText: new RegExp(`^\\s*${navLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`) }).first().click()
  // PAGE_CONTENT also matches the previous page, so first wait for the route itself to change
  // (a click on the page already shown leaves the location unchanged by design and is skipped).
  await until(async () => (await where()) !== before, { timeout: 3000, label: `route change to ${navLabel}` }).catch(() => {})
  await page.locator(PAGE_CONTENT).first().waitFor({ state: 'attached', timeout: 10000 })
  await quiet(page)
}

// SMOKE-COLD-1 (06-11, measured): on a cold Vite `go()` returns ~330 ms after the click with the
// table still empty (rows attach at ~850 ms); a flow that counts rows right away is red alone and
// green in a warmed full run. Wait for the first row (or a given label) to attach, never for a fixed time.
export async function waitForContent(page, selector = 'table tbody tr', { timeout = 15000 } = {}) {
  await page.locator(selector).first().waitFor({ state: 'attached', timeout }).catch(() => {})
}

// Escape closes the open drawer; wait until its tab bar is gone instead of sleeping.
export async function closeDrawer(page) {
  await page.keyboard.press('Escape')
  await page.locator('[role="tablist"]').first().waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {})
}

// True when the sidebar actually shows this nav page (module-gated pages differ per tenant).
export async function hasNav(page, navLabel) {
  return (await page.locator('button', { hasText: new RegExp(`^\\s*${navLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`) }).count()) > 0
}

// Force TABLE view before checking table-only chrome (pagination footer, drill-down
// rows). Several list pages persist their table/board pick in-memory across nav
// (usePageMemory) — if an earlier flow (e.g. boards-drag) left a page in board mode,
// a later flow must not silently skip its table chrome. Structural selector (the
// LayoutList lucide icon every table/board toggle uses for its "table" option, see
// ViewModeToggle call sites) so this works regardless of the button's i18n label,
// which differs per entity namespace. No-op on pages with no board toggle at all
// (candidates/vacancies/customers) or already on table view.
export async function ensureTableView(page) {
  const tableBtn = page.locator('button:has(svg.lucide-layout-list)').first()
  // SMOKE-COLD-1 (06-11, measured on Klanten): on a cold load a toggle can be attached but
  // invisible for a moment and gone 1.5 s later; clicking it waits 30 s and fails the flow.
  // Only a visible toggle is a real view switch (isVisible() answers at once, no waiting).
  if (await tableBtn.count() && await tableBtn.isVisible()) {
    await tableBtn.click()
    // The table (or its empty state) replaces the board; an empty list may render no <table> at all.
    await page.locator('table').first().waitFor({ state: 'attached', timeout: 5000 }).catch(() => {})
    await quiet(page)
  }
}

// Content-leak scan for a drawer/tab's rendered text — the exact classes Danny
// keeps finding by hand and a static audit misses: an untranslated i18n key
// rendered as literal text (dotted `a.b.c` or namespaced `ns:key`), a raw ISO
// timestamp instead of a locale-formatted date, or a stray "undefined"/"NaN".
// Regexes match the CLASS definitions given for this harness; i18n checks run
// per whitespace-token (the dotted-key pattern anchors ^...$, so it must be
// tested against individual words, not the whole multi-line blob).
const RAW_I18N_DOTTED = /^[a-z][a-zA-Z]*(\.[a-zA-Z_]+){2,}$/
const RAW_I18N_NS = /^[a-zA-Z][a-zA-Z0-9_]*:[a-zA-Z][a-zA-Z0-9_.]*$/
const RAW_ISO = /\d{4}-\d{2}-\d{2}T\d{2}:/
const RAW_UNDEFINED_NAN = /\b(undefined|NaN)\b/
export function scanForLeaks(text) {
  const findings = []
  const iso = text.match(RAW_ISO)
  if (iso) findings.push(`raw ISO-timestamp zichtbaar (${iso[0]}…)`)
  const bad = text.match(RAW_UNDEFINED_NAN)
  if (bad) findings.push(`letterlijke "${bad[0]}" zichtbaar`)
  const badTokens = new Set(text.split(/\s+/).filter(tok => RAW_I18N_DOTTED.test(tok) || RAW_I18N_NS.test(tok)))
  if (badTokens.size) findings.push(`onvertaalde i18n-key(s) zichtbaar: ${[...badTokens].slice(0, 5).join(', ')}`)
  return findings
}

// Assert helper that throws with a readable message (runner catches per flow).
export function expect(cond, msg) { if (!cond) throw new Error(msg) }

export const sleep = (ms) => new Promise(r => setTimeout(r, ms))
