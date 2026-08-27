/**
 * harvest-demo-texts — C8 (DEMO-SEED-TAAL-1): read-only inventory of the demo
 * tenant's FREE TEXTS (profile/vacancy/company/match/opportunity/task prose)
 * via the ordinary read APIs, for the FE translation catalogue. Re-runnable:
 * after Danny adds demo content, a re-run diffs new/changed texts against the
 * shipped catalogue. Never touches AI endpoints (API-CREDITS-1); GETs only.
 *   SMOKE_APP=http://localhost:5173 node e2e/harvest-demo-texts.mjs > inventory.json
 */
import { chromium } from 'playwright'

const APP = process.env.SMOKE_APP ?? 'http://localhost:5173'
const CREDS = { email: process.env.SMOKE_EMAIL ?? 'danny@koios.nl', password: process.env.SMOKE_PASSWORD ?? 'password123' }

// Entity list endpoints + which fields of the DETAIL payload carry free text.
const SOURCES = [
  { list: '/api/candidates?per_page=100',  detail: id => `/api/candidates/${id}`,  entity: 'candidate',   fields: ['summary', 'description', 'bio', 'cv_text'] },
  { list: '/api/vacancies?per_page=100',   detail: id => `/api/vacancies/${id}`,   entity: 'vacancy',     fields: ['description', 'vacancy_text', 'text'] },
  { list: '/api/customers?per_page=100',   detail: id => `/api/customers/${id}`,   entity: 'customer',    fields: ['description', 'company_text'] },
  { list: '/api/matches?per_page=100',     detail: id => `/api/matches/${id}`,     entity: 'match',       fields: ['description', 'match_text'] },
  { list: '/api/opportunities?per_page=100', detail: id => `/api/opportunities/${id}`, entity: 'opportunity', fields: ['description'] },
  { list: '/api/tasks?per_page=100',       detail: id => `/api/tasks/${id}`,       entity: 'task',        fields: ['description'] },
]

const browser = await chromium.launch()
const page = await browser.newPage()
await page.addInitScript(() => { localStorage.setItem('active_tenant', 'demo'); localStorage.setItem('km-language', 'nl') })
await page.goto(`${APP}/`, { waitUntil: 'networkidle' })
await page.fill('#login-email', CREDS.email)
await page.fill('input[type="password"]', CREDS.password)
await page.click('button[type="submit"]')
await page.waitForTimeout(2500)

// In-page fetch so the httpOnly session cookie + X-Tenant ride along like the app's own client.
const get = (path) => page.evaluate(async (p) => {
  const res = await fetch(p, { headers: { 'X-Auth-Mode': 'cookie', 'X-Tenant': 'demo', Accept: 'application/json' }, credentials: 'include' })
  if (!res.ok) return { __status: res.status }
  return res.json()
}, path)

const out = []
for (const src of SOURCES) {
  const listBody = await get(src.list)
  const rows = listBody?.data?.data ?? listBody?.data ?? []
  let harvested = 0
  for (const row of (Array.isArray(rows) ? rows : [])) {
    const detail = await get(src.detail(row.id))
    const d = detail?.data ?? detail ?? {}
    for (const f of src.fields) {
      const v = d[f]
      if (typeof v === 'string' && v.trim().length > 40) {
        out.push({ entity: src.entity, id: row.id, field: f, chars: v.length, text: v })
        harvested++
      }
    }
  }
  console.error(`${src.entity}: ${Array.isArray(rows) ? rows.length : 0} records, ${harvested} teksten`)
}
await browser.close()
process.stdout.write(JSON.stringify(out, null, 1))
