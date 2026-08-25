/**
 * probe-page — per-page render check against the REAL app (SCHERMWAARHEID-1): logs in,
 * visits each given hash in a FRESH session, and reports the rendered line count plus
 * console/page errors (it counts "Maximum update depth exceeded" separately, the render
 * loop that took the tasks page down on 25-08). A fresh session per hash is the point:
 * it tells "this page is broken" apart from "the app broke earlier and never recovered".
 * Never touches AI endpoints (API-CREDITS-1).
 *   SMOKE_APP=http://localhost:5173 node e2e/probe-page.mjs '#tasks' '#customers'
 */
import { chromium } from 'playwright'

const APP = process.env.SMOKE_APP ?? 'http://localhost:5173'
const CREDS = { email: process.env.SMOKE_EMAIL ?? 'danny@koios.nl', password: process.env.SMOKE_PASSWORD ?? 'password123' }
const LANG = process.env.PROBE_LANG ?? 'en'
const hashes = process.argv.slice(2)

const browser = await chromium.launch()
const out = []
for (const hash of hashes) {
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', e => errors.push(`[pageerror] ${String(e).slice(0, 200)}`))
  page.on('console', m => { if (m.type() === 'error') errors.push(`[console] ${m.text().slice(0, 200)}`) })
  // Fresh login per hash so an earlier page's crash cannot bleed into this measurement.
  await page.addInitScript(([t, l]) => { localStorage.setItem('active_tenant', t); localStorage.setItem('km-language', l) }, ['demo', LANG])
  await page.goto(`${APP}/`, { waitUntil: 'networkidle' })
  await page.fill('#login-email', CREDS.email)
  await page.fill('input[type="password"]', CREDS.password)
  await page.click('button[type="submit"]')
  await page.waitForTimeout(2500)
  await page.evaluate(h => { window.location.hash = h }, hash)
  await page.waitForTimeout(3000)
  const text = await page.evaluate(() => document.body.innerText)
  const lines = [...new Set(text.split('\n').map(s => s.trim()).filter(s => s.length > 1))]
  const loop = errors.filter(e => /Maximum update depth/.test(e)).length
  out.push({ hash, lines: lines.length, loopErrors: loop, errors: errors.slice(0, 3), sample: lines.slice(0, 8) })
  console.error(`${hash}: ${lines.length} lines, ${loop} update-depth errors, ${errors.length} errors total`)
  await page.close()
}
await browser.close()
process.stdout.write(JSON.stringify(out, null, 1))
