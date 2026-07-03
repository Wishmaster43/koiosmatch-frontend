/**
 * e2e/lib — shared harness for the smoke suite: boots a logged-in page against the
 * REAL app + API (Bearer mode), and collects console/page/network errors per flow.
 * The suite exists because unit tests on both sides stay green while the seam breaks
 * (2026-07-03 audit): these flows click the actual product before Danny does.
 * Dev-tool only — never bundled with the app.
 */
import { chromium } from 'playwright'

export const API = process.env.SMOKE_API ?? 'http://koiosmatch-api.test/api'
export const APP = process.env.SMOKE_APP ?? 'http://localhost:5173'
export const CREDS = { email: process.env.SMOKE_EMAIL ?? 'danny@koios.nl', password: process.env.SMOKE_PASSWORD ?? 'password123' }

// Login via the API and return { token, user } — fails loudly when auth is broken.
export async function apiLogin() {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(CREDS),
  }).then(r => r.json())
  if (!res.token) throw new Error(`API login failed: ${JSON.stringify(res).slice(0, 200)}`)
  return res
}

// One booted context: browser + page with auth seeded and error collectors attached.
// Cookie mode (D1): SMOKE_COOKIE=1 logs in through the REAL UI form — there is no token
// in JS to seed anymore, which is exactly what the flip proves.
export async function boot({ tenant = 'demo' } = {}) {
  const cookieMode = process.env.SMOKE_COOKIE === '1'
  const browser = await chromium.launch()
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', e => errors.push(`[pageerror] ${String(e).slice(0, 250)}`))
  page.on('console', m => { if (m.type() === 'error') errors.push(`[console] ${m.text().slice(0, 250)}`) })
  page.on('response', async r => {
    if (r.status() >= 400) {
      // Include the response body — a bare "422" hides WHICH rule failed (the whole point).
      let body = ''
      try { body = (await r.text()).slice(0, 200) } catch { /* stream may be gone */ }
      errors.push(`[http ${r.status()}] ${r.request().method()} ${r.url().split('/api/')[1] ?? r.url()} ${body}`)
    }
  })

  let login = null
  if (cookieMode) {
    await page.goto(`${APP}/`, { waitUntil: 'networkidle' })
    await page.fill('#login-email', CREDS.email)
    await page.fill('input[type="password"]', CREDS.password)
    await page.click('button[type="submit"]')
    await page.waitForTimeout(2500)
    // Sanity: the shell rendered (logout button) and no token leaked into storage.
    const token = await page.evaluate(() => localStorage.getItem('auth_token'))
    if (token) errors.push('[d1] auth_token staat in localStorage terwijl cookie-mode aan is!')
  } else {
    login = await apiLogin()
    await page.addInitScript(([token, user, t]) => {
      localStorage.setItem('auth_token', token)
      localStorage.setItem('auth_user', JSON.stringify(user))
      localStorage.setItem('active_tenant', t)
    }, [login.token, login.user, tenant])
    await page.goto(`${APP}/`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1200)
  }
  return { browser, page, errors, login }
}

// Navigate via the sidebar (hash boot is flaky headless; the sidebar is the real UX path).
export async function go(page, navLabel, ms = 1400) {
  await page.locator(`text=${navLabel}`).first().click()
  await page.waitForTimeout(ms)
}

// Assert helper that throws with a readable message (runner catches per flow).
export function expect(cond, msg) { if (!cond) throw new Error(msg) }

export const sleep = (ms) => new Promise(r => setTimeout(r, ms))
