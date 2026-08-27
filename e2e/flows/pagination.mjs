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
// 13-08: probe rebuilt for the SelectMenu footer (the native <select> it used to
// drive was replaced by the house searchable menu — the probe tested old furniture).
const FOOTER_LABEL = 'Rijen per pagina'

export async function pagination({ page, errors }) {
  const findings = []
  for (const { nav } of ENTITIES) {
    await go(page, nav)
    await ensureTableView(page)

    // 1. Footer must exist — this alone catches a page shipping no pagination at all.
    const hasFooter = (await page.locator(`text=${FOOTER_LABEL}`).count()) > 0
    if (!hasFooter) { findings.push(`${nav}: GEEN paginering-footer gevonden`); continue }

    // The footer migrated from a native <select> to the shared searchable
    // SelectMenu (house rule: never a bare <select>) — drive it like a user:
    // the trigger is the button labelled by the FOOTER_LABEL element.
    const labelId = await page.locator(`text=${FOOTER_LABEL}`).first().getAttribute('id')
    // aria-labelledby carries an id LIST (label + trigger id) — match by word.
    const trigger = page.locator(`button[aria-labelledby~="${labelId}"]`)
    if ((await trigger.count()) === 0) { findings.push(`${nav}: geen footer-trigger (SelectMenu) gevonden`); continue }
    await trigger.click()
    const listId = await trigger.getAttribute('aria-controls')
    // Options render as buttons inside the popup (the search input is not a button).
    const options = await page.locator(`[id="${listId}"] button`).allTextContents()
    await page.keyboard.press('Escape')
    if (options.length === 0) { findings.push(`${nav}: footer-select biedt geen opties aan`); continue }

    // 2/3. Every OFFERED size must round-trip cleanly — bail this page on the first bad one.
    for (const opt of options) {
      const at = errors.length
      const toastBefore = await page.locator('[role="alert"]').count()
      await trigger.click()
      const lid = await trigger.getAttribute('aria-controls')
      await page.locator(`[id="${lid}"] button`, { hasText: opt }).first().click()
      await sleep(1300)
      const fresh = errors.slice(at)
      const toastAfter = await page.locator('[role="alert"]').count()
      if (fresh.length) { findings.push(`${nav} @ ${opt}/pagina: ${fresh.join(' | ')}`); break }
      if (toastAfter > toastBefore) { findings.push(`${nav} @ ${opt}/pagina: foutmelding (toast) verscheen`); break }
      const shown = Number((await trigger.textContent())?.replace(/\D/g, ''))
      if (shown > Number(opt)) { findings.push(`${nav} @ ${opt}/pagina: trigger toont ${shown} (groter dan het gekozen ${opt} — onmogelijk, dode/foute clamp)`); break }
    }
  }
  expect(findings.length === 0, findings.join('\n    '))
}
