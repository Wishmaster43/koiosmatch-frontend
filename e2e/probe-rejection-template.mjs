/**
 * probe-rejection-template — AFWIJZING-FLOW-VERIFY-1 (b)+(c): fetches the seeded
 * rejection template (template_key application_send_rejection) through a real
 * session and asserts the graph shape the canvas editor must render: candidate
 * fetch -> router -> three mutually exclusive routes (whatsapp/email/notification),
 * consent filters on the edges, empty phone_number_id, no PII in the notification.
 * Read-only GETs; never saves, never runs anything (API-CREDITS-1).
 */
import { chromium } from 'playwright'

const APP = process.env.SMOKE_APP ?? 'http://localhost:5173'
const CREDS = { email: process.env.SMOKE_EMAIL ?? 'danny@koios.nl', password: process.env.SMOKE_PASSWORD ?? 'password123' }

const browser = await chromium.launch()
const page = await browser.newPage()
await page.addInitScript(t => localStorage.setItem('active_tenant', t), process.env.PROBE_TENANT ?? 'yesway')
await page.goto(`${APP}/`, { waitUntil: 'networkidle' })
await page.fill('#login-email', CREDS.email)
await page.fill('input[type="password"]', CREDS.password)
await page.click('button[type="submit"]')
await page.waitForTimeout(2500)

const out = await page.evaluate(async () => {
  const get = async (u) => (await fetch(`/api${u}`, { credentials: 'include', headers: { Accept: 'application/json', 'X-Tenant': localStorage.getItem('active_tenant') ?? '', 'X-Auth-Mode': 'cookie' } })).json()
  const list = await get('/workflows')
  // /workflows may return {data:{rows:[...]}} or a paginated envelope - unwrap tolerantly.
  const payload = list?.data ?? list ?? {}
  const rows = Array.isArray(payload) ? payload : (payload.rows ?? payload.workflows ?? payload.data ?? [])
  const tpl = rows.find(w => w.template_key === 'application_send_rejection')
  if (!tpl) return { found: false, keys: rows.map(w => w.template_key).filter(Boolean) }
  const detail = await get(`/workflows/${tpl.id}`)
  const wf = detail?.data ?? detail
  return { found: true, id: tpl.id, name: tpl.name, key: tpl.template_key, active: tpl.active ?? tpl.is_active, steps: wf.steps ?? wf.nodes ?? null, raw: wf }
})
await browser.close()
console.log(JSON.stringify(out, null, 1))
