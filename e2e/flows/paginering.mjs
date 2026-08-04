/**
 * Smoke flow: pagination-footer contract for every entity list page (Danny 05-08 —
 * "ik vind het heel slecht welke bugs ik vind en jij doet elke keer een audit").
 * Two LIVE classes he kept finding by clicking, that a static audit misses: a list
 * page shipping NO pagination footer at all, and rows-per-page OPTIONS the select
 * offers that the server 422s on (per_page above the endpoint's real cap, measured
 * at 200 on most entities — see naad-contract.mjs). Per page this asserts:
 *   1. the shared PaginationBar footer actually renders;
 *   2. EVERY option its <select> currently offers can be picked without a 4xx/5xx
 *      on the resulting list request, and without a visible error toast;
 *   3. the footer afterwards honestly reflects the chosen (or server-clamped) size
 *      — never silently stuck showing a number bigger than what's actually in effect.
 * Bails per page on the first bad option (runtime budget) but still visits every page.
 */
import { go, ensureTableView, expect, sleep } from '../lib.mjs'
import { ENTITIES } from './entities.mjs'

// The exact Dutch label PaginationBar renders next to its <select> — the one string
// that only exists when the shared footer component is actually mounted (see
// components/ui/PaginationBar.tsx). Absence of this IS "no footer", not a fluke.
const FOOTER_LABEL = 'Rijen per pagina'

export async function paginering({ page, errors }) {
  const findings = []
  for (const { nav } of ENTITIES) {
    await go(page, nav)
    await ensureTableView(page)

    // 1. Footer must exist — this alone catches a page shipping no pagination at all.
    const hasFooter = (await page.locator(`text=${FOOTER_LABEL}`).count()) > 0
    if (!hasFooter) { findings.push(`${nav}: GEEN paginering-footer gevonden`); continue }

    const select = page.locator('select').last()
    const options = await select.locator('option').allTextContents()
    if (options.length === 0) { findings.push(`${nav}: footer-select biedt geen opties aan`); continue }

    // 2/3. Every OFFERED size must round-trip cleanly — bail this page on the first bad one.
    for (const opt of options) {
      const at = errors.length
      const toastBefore = await page.locator('[role="alert"]').count()
      await select.selectOption(opt)
      await sleep(1300)
      const fresh = errors.slice(at)
      const toastAfter = await page.locator('[role="alert"]').count()
      if (fresh.length) { findings.push(`${nav} @ ${opt}/pagina: ${fresh.join(' | ')}`); break }
      if (toastAfter > toastBefore) { findings.push(`${nav} @ ${opt}/pagina: foutmelding (toast) verscheen`); break }
      const shown = Number(await select.inputValue())
      if (shown > Number(opt)) { findings.push(`${nav} @ ${opt}/pagina: select toont ${shown} (groter dan het gekozen ${opt} — onmogelijk, dode/foute clamp)`); break }
    }
  }
  expect(findings.length === 0, findings.join('\n    '))
}
