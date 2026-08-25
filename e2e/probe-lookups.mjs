/**
 * probe-lookups — dumps what the SERVER actually sends for every tenant lookup
 * (value + label per family), so a translation decision is made on measured data
 * instead of on the frontend's own seed constants. Read-only GETs through a real
 * logged-in session; never touches an AI endpoint (API-CREDITS-1).
 *   node e2e/probe-lookups.mjs > lookups.json
 */
import { chromium } from 'playwright'

const APP = process.env.SMOKE_APP ?? 'http://localhost:5173'
const CREDS = { email: process.env.SMOKE_EMAIL ?? 'danny@koios.nl', password: process.env.SMOKE_PASSWORD ?? 'password123' }

// Every lookup endpoint the frontend reads (grepped from the hooks + the two contexts).
const ENDPOINTS = [
  '/settings/candidate-lookups', '/settings/customer-lookups',
  '/application-stages', '/appointment-locations', '/appointment-types',
  '/candidate-rejection-reasons', '/candidate-sources', '/cao', '/contact-functions',
  '/contract-types', '/customer-phases', '/driver-licenses', '/education-levels',
  '/functions', '/genders', '/industries', '/language-levels', '/languages',
  '/last-contact-types', '/match-statuses', '/nationalities', '/note-types?entity=candidate',
  '/numbering-entities', '/opportunity-stages', '/outreach-outcomes', '/outreach-statuses',
  '/pools', '/skill-levels', '/work-permit-types',
  '/vacancy-statuses', '/vacancy-phases', '/task-statuses', '/task-types', '/task-priorities',
  '/escalation-reasons', '/reference-relations', '/emergency-contact-relations',
  '/vacancy-seniority-levels', '/vacancy-education-levels', '/vacancy-channels',
  '/document-types?entity=candidate', '/workflow-folders', '/workflows',
]

const browser = await chromium.launch()
const page = await browser.newPage()
await page.addInitScript(t => localStorage.setItem('active_tenant', t), 'demo')
await page.goto(`${APP}/`, { waitUntil: 'networkidle' })
await page.fill('#login-email', CREDS.email)
await page.fill('input[type="password"]', CREDS.password)
await page.click('button[type="submit"]')
await page.waitForTimeout(2500)

// Fetch inside the page so the session cookie and the tenant header ride along.
const out = await page.evaluate(async (endpoints) => {
  const result = {}
  for (const ep of endpoints) {
    try {
      const res = await fetch(`/api${ep}`, { credentials: 'include', headers: { Accept: 'application/json' } })
      if (!res.ok) { result[ep] = { status: res.status }; continue }
      const body = await res.json()
      const payload = body?.data ?? body
      // Reduce every shape (list, or an object of lists) to value/label pairs.
      const pairs = (rows) => (Array.isArray(rows) ? rows : []).map(r => (
        typeof r === 'string' ? { value: r, label: r }
          : { value: String(r?.value ?? r?.id ?? r?.key ?? r?.name ?? ''), label: String(r?.label ?? r?.name ?? r?.value ?? '') }
      ))
      if (Array.isArray(payload)) result[ep] = { rows: pairs(payload) }
      else if (payload && typeof payload === 'object') {
        const sub = {}
        for (const [k, v] of Object.entries(payload)) if (Array.isArray(v)) sub[k] = pairs(v)
        result[ep] = { groups: sub }
      } else result[ep] = { raw: String(payload).slice(0, 200) }
    } catch (e) { result[ep] = { error: String(e).slice(0, 160) } }
  }
  return result
}, ENDPOINTS)

await browser.close()
process.stdout.write(JSON.stringify(out, null, 1))
