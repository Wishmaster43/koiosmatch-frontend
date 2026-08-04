/**
 * Smoke flow: FE/BE per_page contract at the API level (Danny 05-08 — the seam
 * that keeps breaking: a page OFFERS a rows-per-page option the server 422s on).
 * Hits every entity's list endpoint directly, through the app's own same-origin
 * Vite proxy + cookie session (a bare request straight at the API host, or via
 * Playwright's APIRequestContext, both 401 — measured: Sanctum's stateful guard
 * needs the Origin/Referer an actual in-page fetch sends, see the boot() comment
 * in lib.mjs), for the full canonical per_page ladder. Asserts every size the FE
 * ACTUALLY OFFERS in its own <select> gets a clean 2xx — a size already clamped
 * away is exempt (that IS the fix working) but still measured and printed, so the
 * report always shows "FE max vs. server's real cap" per entity (current-state
 * truth, per_page-clamp work may be mid-flight elsewhere).
 */
import { go, ensureTableView, expect } from '../lib.mjs'
import { ENTITIES } from './entities.mjs'

// The full canonical ladder PaginationBar's shared PAGE_SIZE_OPTIONS offers before
// any per-entity clamp (components/ui/PaginationBar.tsx) — probed in full on every
// endpoint to find its REAL cap, regardless of what any one page currently exposes.
const LADDER = [50, 100, 200, 300, 400, 500]

// In-page fetch (not page.request — see the docblock above): the session cookie
// the real login sets then authenticates exactly like every request the app itself makes.
async function fetchPerPage(page, endpoint, perPage) {
  return page.evaluate(async ([ep, n]) => {
    const r = await fetch(`/api${ep}?per_page=${n}`, { headers: { 'X-Tenant': 'demo', Accept: 'application/json' }, credentials: 'include' })
    let message = ''
    if (r.status >= 400) { try { message = (await r.json())?.message ?? '' } catch { /* no json body */ } }
    return { status: r.status, message }
  }, [endpoint, perPage])
}

export async function naadContract({ page }) {
  const findings = []
  const report = []
  for (const { nav, endpoint } of ENTITIES) {
    // Read the FE's OWN offered options straight from the live select — this IS
    // "the FE options list" this flow reconciles against the server's real cap.
    await go(page, nav)
    await ensureTableView(page)
    const hasFooter = (await page.locator('text=Rijen per pagina').count()) > 0
    const feOptions = hasFooter
      ? (await page.locator('select').last().locator('option').allTextContents()).map(Number)
      : []

    const measured = {}
    for (const size of LADDER) {
      const { status, message } = await fetchPerPage(page, endpoint, size)
      measured[size] = status
      if (feOptions.includes(size) && (status < 200 || status >= 300)) {
        findings.push(`${nav} (${endpoint}) @ per_page=${size}: FE biedt dit aan, server gaf ${status} ${message}`)
      }
    }
    const measuredCap = LADDER.filter(s => measured[s] >= 200 && measured[s] < 300).at(-1) ?? 0
    report.push(`${nav} (${endpoint}): FE max=${feOptions.at(-1) ?? '— (geen footer)'}` +
      ` | server: ${LADDER.map(s => `${s}=${measured[s]}`).join(' ')} | gemeten cap=${measuredCap}`)
  }
  console.log('\n   per_page-contract (FE-optie vs. server-antwoord, per entiteit):')
  report.forEach(line => console.log(`   ${line}`))
  expect(findings.length === 0, findings.join('\n    '))
}
