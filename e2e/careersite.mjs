/**
 * Standalone smoke suite for the PUBLIC career site (careersite/, app #3) — a
 * separate command from `npm run smoke` (that suite + its flows are untouched).
 * Runs against the REAL careersite dev server + the REAL API, no admin login
 * (this app is fully unauthenticated, CLAUDE.md §7) and no shared session with
 * e2e/lib.mjs, which boots the ADMIN app instead. Usage:
 *   npm run smoke:career
 * Requires: `npm run dev:career` (careersite on :5273) + the koiosmatch-api Herd site.
 * Env overrides: CAREER_APP, CAREER_API, CAREER_TENANT (default tenant: yesway).
 */
import { chromium } from 'playwright'

const APP = process.env.CAREER_APP ?? 'http://localhost:5273'
const API = process.env.CAREER_API ?? 'http://koiosmatch-api.test/api'
const TENANT = process.env.CAREER_TENANT ?? 'yesway'

// Tiny local helpers — kept inline rather than imported from e2e/lib.mjs: that
// module's `boot()` logs into the ADMIN app, a different trust boundary this
// public-site suite must never touch.
function expect(cond, msg) { if (!cond) throw new Error(msg) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Pre-check: is the careersite dev server even running? A connection-refused here
// is not a product bug — it just means `npm run dev:career` was never started.
try {
  const res = await fetch(`${APP}/`, { signal: AbortSignal.timeout(5000) })
  if (res.status >= 500) throw new Error(`status ${res.status}`)
} catch (e) {
  console.error(`✗ careersite-dev (${APP}) is NIET bereikbaar (${e?.message}).`)
  console.error(`  Start 'm eerst met: npm run dev:career`)
  process.exit(2)
}

// Pre-check: is the API up? Mirrors run.mjs's guard so a dead backend reads as
// one unambiguous line instead of every flow failing on a generic timeout.
try {
  const res = await fetch(`${API}/public/${TENANT}/site`, { signal: AbortSignal.timeout(8000) })
  if (res.status >= 500) throw new Error(`status ${res.status}`)
} catch (e) {
  console.error(`✗ API (${API}) is NIET bereikbaar (${e?.message}) — start/herstel de backend en run opnieuw.`)
  process.exit(2)
}

const browser = await chromium.launch()
const page = await browser.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(`[pageerror] ${String(e).slice(0, 250)}`))
page.on('console', (m) => {
  if (m.type() !== 'error') return
  const text = m.text().slice(0, 250)
  // A bare 404 (e.g. a vacancy reference that no longer exists, or a data
  // endpoint gated behind the CAREER-SITE-ACTIVE flag) is expected noise, not
  // a finding on its own; any other console error (5xx, a thrown exception, …)
  // still fails the flow.
  if (/Failed to load resource.*404/.test(text)) return
  errors.push(`[console] ${text}`)
})
// Shared state between flows: flow 1 records which of the three settled UI
// states it saw, so flows 2/3 know whether a real vacancy is available to
// click through — set once assigned below.
const ctx = { page, errors, listState: null }

// Flow 1: the list page always lands in ONE of three calm states — never a
// blank/crashed page. Which one it is depends on the seeded data (data-afhankelijk).
async function listRenders({ page, errors }) {
  const at = errors.length
  await page.goto(`${APP}/${TENANT}/vacatures`, { waitUntil: 'networkidle' })
  // Poll past the initial loading state until one of the three settled shapes appears.
  // Text match on the actual NL copy (CAREER-SITE-ACTIVE, theme.tsx/strings.ts) — the
  // dedicated "not active" notice is a distinct handled state, never the generic error.
  let state = null
  for (let tries = 0; tries < 15 && !state; tries++) {
    await sleep(400)
    if (await page.locator('.vacancy-card').count()) { state = 'kaarten'; break }
    const bodyText = await page.locator('body').innerText()
    if (/geen vacatures gevonden/i.test(bodyText)) { state = 'lege-staat'; break }
    if (/niet actief/i.test(bodyText)) { state = 'site-niet-actief'; break }
  }
  const fresh = errors.slice(at)
  expect(fresh.length === 0, `onverwachte fout tijdens laden: ${fresh.join(' | ')}`)
  expect(Boolean(state), 'geen herkenbare staat (kaarten/lege-staat/site-niet-actief) binnen 6s — kale pagina of crash')
  console.log(`   staat gezien: ${state}`)
  ctx.listState = state
}

// Flow 2: only meaningful when a real vacancy exists — click through and verify
// the detail renders content plus the Google Jobs JSON-LD block for SEO.
async function detailAndSeo({ page, errors }) {
  if (ctx.listState !== 'kaarten') {
    console.log('   SKIP: geen vacaturekaarten in deze omgeving (site niet actief/leeg) — niets om door te klikken.')
    return
  }
  const at = errors.length
  await page.goto(`${APP}/${TENANT}/vacatures`, { waitUntil: 'networkidle' })
  const card = page.locator('.vacancy-card').first()
  await card.waitFor({ timeout: 8000 })
  await card.click()
  await page.waitForLoadState('networkidle')
  await sleep(600)
  expect(await page.locator('h1').count(), 'detailpagina toont geen titel (h1)')
  expect(await page.locator('.vacancy-detail__description').count(), 'detailpagina toont geen beschrijving-sectie')
  const ld = page.locator('script[type="application/ld+json"]')
  expect(await ld.count(), 'detailpagina mist het Google Jobs JSON-LD <script>-blok')
  const ldContent = (await ld.first().textContent()) ?? ''
  // Must be real, parseable JSON — not just a present-but-empty tag.
  let ldIsValidJson = false
  try { JSON.parse(ldContent); ldIsValidJson = true } catch { /* left false */ }
  expect(ldIsValidJson, 'json-ld is geen geldig JSON')
  const fresh = errors.slice(at)
  expect(fresh.length === 0, `detailpagina gaf fouten: ${fresh.join(' | ')}`)
}

// Flow 3: the apply form must block its own submit client-side when required
// fields/consent are missing — and, crucially, never fire the network request.
async function applyFormBlocksInvalidSubmit({ page, errors }) {
  if (ctx.listState !== 'kaarten') {
    console.log('   SKIP: geen vacature beschikbaar om het sollicitatieformulier op te testen.')
    return
  }
  const at = errors.length
  await page.goto(`${APP}/${TENANT}/vacatures`, { waitUntil: 'networkidle' })
  const card = page.locator('.vacancy-card').first()
  await card.waitFor({ timeout: 8000 })
  await card.click()
  await page.waitForLoadState('networkidle')
  await page.locator('#solliciteren').scrollIntoViewIfNeeded()
  // Guard: no POST to the apply endpoint may ever fire from this blocked-submit flow.
  let applyRequestSeen = false
  const onRequest = (req) => {
    if (req.method() === 'POST' && /\/vacancies\/[^/]+\/apply/.test(req.url())) applyRequestSeen = true
  }
  page.on('request', onRequest)
  const submitBtn = page.locator('.apply-form button[type="submit"]')
  expect(await submitBtn.count(), 'sollicitatieformulier (of submit-knop) niet gevonden op de detailpagina')
  await submitBtn.click()
  await sleep(500)
  const fieldErrors = await page.locator('.apply-form .field-error').count()
  page.off('request', onRequest)
  expect(fieldErrors > 0, 'formulier toont geen client-validatiefouten bij een lege, niet-akkoord-gegeven inzending')
  expect(!applyRequestSeen, 'het formulier deed toch een POST naar /apply ondanks ontbrekende verplichte velden/consent')
  const fresh = errors.slice(at)
  expect(fresh.length === 0, `formulier-check gaf fouten: ${fresh.join(' | ')}`)
}

const FLOWS = [
  ['lijst-rendert', listRenders],
  ['detail-en-seo', detailAndSeo],
  ['apply-form-client-validatie', applyFormBlocksInvalidSubmit],
]

const filter = process.argv[2]
const results = []
for (const [name, fn] of FLOWS) {
  if (filter && !name.includes(filter)) continue
  const t0 = Date.now()
  try {
    await fn(ctx)
    results.push([name, true, Date.now() - t0])
    console.log(`✓ ${name} (${Date.now() - t0}ms)`)
  } catch (e) {
    results.push([name, false, Date.now() - t0])
    console.log(`✗ ${name}\n    ${String(e.message ?? e).slice(0, 500)}`)
  }
  // Reset the error window between flows so one flow's noise never bleeds into the next.
  errors.length = 0
}

await browser.close()
const failed = results.filter((r) => !r[1])
console.log(`\n===== SMOKE:CAREER: ${results.length - failed.length}/${results.length} groen =====`)
process.exit(failed.length ? 1 : 0)
