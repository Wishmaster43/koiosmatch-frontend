/**
 * e2e/lib — shared harness for the smoke suite: boots a logged-in page against the
 * REAL app + API (cookie auth — the only mode, H3), and collects console/page/
 * network errors per flow.
 * The suite exists because unit tests on both sides stay green while the seam breaks
 * (2026-07-03 audit): these flows click the actual product before Danny does.
 * Dev-tool only — never bundled with the app.
 */
import { chromium } from 'playwright'

export const API = process.env.SMOKE_API ?? 'http://koiosmatch-api.test/api'
export const APP = process.env.SMOKE_APP ?? 'http://localhost:5173'
export const CREDS = { email: process.env.SMOKE_EMAIL ?? 'danny@koios.nl', password: process.env.SMOKE_PASSWORD ?? 'password123' }

// One booted context: browser + page with auth seeded and error collectors attached.
// Cookie-only (H3, 2026-07-08): the Bearer flow was removed from the app, so the
// suite ALWAYS logs in through the REAL UI form — there is no token in JS to seed.
export async function boot({ tenant = 'demo' } = {}) {
  const browser = await chromium.launch()
  const page = await browser.newPage()
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
  await page.waitForTimeout(2500)
  // D1/H3 guard: no credential may ever appear in localStorage.
  const token = await page.evaluate(() => localStorage.getItem('auth_token'))
  if (token) errors.push('[d1] auth_token staat in localStorage — het Bearer-pad is gesloopt, dit mag NOOIT!')
  return { browser, page, errors }
}

// Navigate via the sidebar (hash boot is flaky headless; the sidebar is the real UX path).
// Match the exact BUTTON text — the old `text=` substring matcher could hit page content
// (e.g. a heading or settings row) and then fail on "element intercepts pointer events".
export async function go(page, navLabel, ms = 1400) {
  await page.locator('button', { hasText: new RegExp(`^\\s*${navLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`) }).first().click()
  await page.waitForTimeout(ms)
}

// True when the sidebar actually shows this nav page (module-gated pages differ per tenant).
export async function hasNav(page, navLabel) {
  return (await page.locator('button', { hasText: new RegExp(`^\\s*${navLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`) }).count()) > 0
}

// Assert helper that throws with a readable message (runner catches per flow).
export function expect(cond, msg) { if (!cond) throw new Error(msg) }

export const sleep = (ms) => new Promise(r => setTimeout(r, ms))
