/**
 * Smoke flow: report deep-link + legacy-alias + KPI drill (report-deeplink.mjs).
 * Guards three seams no other flow covers:
 *   1. a report hash URL opened COLD (fresh page.goto, not client nav) renders
 *      the right report/view — `#reports.candidates?view=leads` must land on
 *      the Leads position (useReportSwitch reads `?view=` on mount, reportIds.ts).
 *   2. the legacy alias `#reports.leads` resolves to the SAME candidates-report
 *      leads view via LEGACY_REPORT_ROUTE_ALIASES (reportIds.ts) — Danny's ruling
 *      "leads valt onder candidates" (28-08); this is that ruling's regression
 *      guard.
 *   3. clicking a KPI card opens ReportDrillDrawer with real rows or an honest
 *      empty state (never a blank drawer), and closes cleanly.
 * ROUTING and DATA are asserted separately (verify-les 28-08: the first version
 * conflated them and reported a routing bug that did not exist while the real
 * defect was a 422 on the data fetch — the scalar-phase seam this flow found).
 * Read-only throughout: asserts zero POST/PATCH/DELETE fired, and zero request
 * to /api/ai/ (API-CREDITS-1 — this flow must never be able to trigger an AI call).
 */
import { APP, expect, sleep } from '../lib.mjs'

// Data marker: a KPI-card label unique to the Leads position that only renders
// after the report GET returned 200 (analytics:leads.total, nl "Totaal leads").
const LEADS_DATA_MARKER = 'Totaal leads'

// ROUTING assertion: the switch bar's active radio must be the Leads position —
// this proves the deep-link/alias landed right even when the data fetch fails.
async function expectLeadsPosition(page, label) {
  const active = page.locator('[role="radio"][aria-checked="true"]')
  expect((await active.count()) > 0, `${label}: no active switch position rendered at all`)
  const text = (await active.allTextContents()).join(' ')
  expect(/Leads/i.test(text), `${label}: active switch position is "${text}", not Leads — routing seam broken`)
}

export async function reportDeeplinkDrill({ page, errors }) {
  // Network guard armed BEFORE any navigation: collect every request so
  // assertGuards can check read-only + no /api/ai/ (API-CREDITS-1) on every
  // path, pass or fail. Entries store method/url as PROPERTIES (plain strings).
  const requests = []
  const onRequest = req => requests.push({ method: req.method(), url: req.url() })
  page.on('request', onRequest)

  try {
    // 1. Cold deep-link: routing first, then data — separate, honest messages.
    await page.goto(`${APP}/#reports.candidates?view=leads`, { waitUntil: 'networkidle' })
    await sleep(1200)
    await expectLeadsPosition(page, 'cold deep-link #reports.candidates?view=leads')
    expect((await page.locator(`text=${LEADS_DATA_MARKER}`).count()) > 0,
      `cold deep-link routed to Leads but the data did not render (missing "${LEADS_DATA_MARKER}" — report GET failed?)`)

    // 2. Legacy alias: #reports.leads must resolve to the SAME leads view
    // (LEGACY_REPORT_ROUTE_ALIASES → reportId=candidates, view=leads).
    await page.goto(`${APP}/#reports.leads`, { waitUntil: 'networkidle' })
    await sleep(1200)
    await expectLeadsPosition(page, 'legacy alias #reports.leads')
    expect((await page.locator(`text=${LEADS_DATA_MARKER}`).count()) > 0,
      `legacy alias routed to Leads but the data did not render (missing "${LEADS_DATA_MARKER}")`)

    // 3. Click the first KPI card (the explicit `role="button"` interactive
    // cards — InsightsRow/KpiCard — as opposed to the switch bar's radios).
    const kpiCard = page.locator('[role="button"]').first()
    expect((await kpiCard.count()) > 0, 'no clickable KPI card found on the Leads view')
    await kpiCard.click()
    await sleep(1000)

    // Drawer opens as a role="dialog" (RightDrawer) — its presence alone proves
    // the click wired through to ReportDrillDrawer.
    const dialog = page.locator('[role="dialog"]')
    expect((await dialog.count()) > 0, 'clicking a KPI card did not open the ReportDrillDrawer')

    // Rows XOR the real empty-state text — never a blank drawer. The records
    // section renders row links, the empty state renders drill.noRecords
    // ("Geen onderliggende records.", analytics.json). No digit-anywhere
    // fallback: a blank/loading drawer must FAIL here (verify-les 28-08).
    const rowCount = await dialog.locator('[role="button"], a').count()
    const emptyCount = await dialog.locator('text=Geen onderliggende records').count()
    expect(rowCount > 0 || emptyCount > 0,
      'drawer opened but shows neither record rows nor the honest empty state — blank drawer')

    // 4. Close the drawer via Escape (RightDrawer wires Escape to onClose)
    // and confirm it is gone; fall back to the explicit close button.
    await page.keyboard.press('Escape')
    await sleep(500)
    if ((await page.locator('[role="dialog"]').count()) > 0) {
      const closeBtn = page.locator('[role="dialog"] button[aria-label]').last()
      if (await closeBtn.count() > 0) await closeBtn.click()
      await sleep(500)
    }
    expect((await page.locator('[role="dialog"]').count()) === 0, 'drawer did not close (Escape nor close button worked)')
  } catch (mainErr) {
    // Guards still run on the failure path (verify-les 28-08: they were dead
    // code after the try) — but a guard hit must never MASK the step failure,
    // so both messages travel together.
    try { assertGuards(requests) } catch (guardErr) {
      throw new Error(`${mainErr.message} — AND ${guardErr.message}`)
    }
    throw mainErr
  } finally {
    page.off('request', onRequest)
  }

  // 5. Success path: the same read-only + credit guard.
  assertGuards(requests)
  void errors
}

// Read-only + credit guard over the collected traffic: no mutating verb, no
// /api/ai/ call (API-CREDITS-1). Entries carry method/url as plain strings.
function assertGuards(requests) {
  const mutating = requests.filter(r => ['POST', 'PATCH', 'PUT', 'DELETE'].includes(r.method)
    && !/\/(login|sanctum|csrf)/.test(r.url))
  expect(mutating.length === 0, `flow fired mutating request(s): ${mutating.map(r => `${r.method} ${r.url}`).join(', ')}`)
  const aiCalls = requests.filter(r => r.url.includes('/api/ai/'))
  expect(aiCalls.length === 0, `flow triggered an AI endpoint (API-CREDITS-1 violation): ${aiCalls.map(r => r.url).join(', ')}`)
}
