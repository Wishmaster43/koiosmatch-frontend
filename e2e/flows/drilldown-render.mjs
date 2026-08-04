/**
 * Smoke flow: drill-down render integrity for every entity (Danny 05-08 — the live
 * bugs a static audit misses: a tab whose fields contradict a sibling tab, a raw
 * ISO timestamp instead of a formatted date, a dead-looking control). This opens
 * the FIRST row's drawer per entity and clicks EVERY tab — and every sub-tab bar
 * nested inside a tab's content, if one renders — asserting per (sub-)tab: no
 * console/network error, no raw i18n key, no raw ISO timestamp, no literal
 * "undefined"/"NaN" text (see lib.mjs's scanForLeaks for the exact patterns).
 * Bails per entity on the first bad tab (runtime budget) but still visits every entity.
 */
import { go, ensureTableView, expect, sleep, scanForLeaks } from '../lib.mjs'
import { ENTITIES } from './entities.mjs'

export async function drilldownRender({ page, errors }) {
  const findings = []
  for (const { nav } of ENTITIES) {
    await go(page, nav)
    await ensureTableView(page)

    // Open the first row's drawer (mirrors nav.mjs's drillDowns: wait for a real
    // row instead of counting instantly — the DataTable loading skeleton means an
    // instant count reads as empty on a fast machine, 20-07 flake).
    const row = page.locator('table tbody tr').first()
    await row.waitFor({ timeout: 10000 }).catch(() => {})
    if (!(await row.count())) { findings.push(`${nav}: geen rijen om open te klikken`); continue }
    await row.click()
    await sleep(1000)

    // DrawerTabs AND SubTabBar both render role=tablist > role=tab (the shared
    // components/drawer/{DrawerTabs,SubTabBar}.tsx) — one structural selector
    // works for every entity's outer tab bar and any inner sub-tab bar, regardless
    // of i18n label. The drawer's own root sits exactly two DOM levels above the
    // outer tablist (EntityDrawer: <root><headerWrap>…tablist</headerWrap><content/
    // ></root>) — the only anchor that also reaches the scrollable content sibling.
    const outerTablist = page.locator('[role="tablist"]').first()
    if (!(await outerTablist.count())) { findings.push(`${nav}: drawer opende niet (geen tabblad-balk gevonden)`); continue }
    const drawer = outerTablist.locator('xpath=../..')
    const outerCount = await outerTablist.locator('[role="tab"]').count()

    let entityFailed = false
    for (let i = 0; i < outerCount && !entityFailed; i++) {
      const tab = page.locator('[role="tablist"]').first().locator('[role="tab"]').nth(i)
      const label = (await tab.innerText()).trim()
      const at = errors.length
      await tab.click()
      await sleep(800)
      const fresh = errors.slice(at)
      if (fresh.length) { findings.push(`${nav} / ${label}: ${fresh.join(' | ')}`); entityFailed = true; break }
      const leaks = scanForLeaks(await drawer.innerText())
      if (leaks.length) { findings.push(`${nav} / ${label}: ${leaks.join(' | ')}`); entityFailed = true; break }

      // A second role=tablist now on screen = a sub-tab bar rendered by this tab's content.
      const tablists = page.locator('[role="tablist"]')
      if (await tablists.count() > 1) {
        const sub = tablists.nth(1)
        const subCount = await sub.locator('[role="tab"]').count()
        for (let j = 0; j < subCount && !entityFailed; j++) {
          const subTab = sub.locator('[role="tab"]').nth(j)
          const subLabel = (await subTab.innerText()).trim()
          const at2 = errors.length
          await subTab.click()
          await sleep(800)
          const fresh2 = errors.slice(at2)
          if (fresh2.length) { findings.push(`${nav} / ${label} / ${subLabel}: ${fresh2.join(' | ')}`); entityFailed = true; break }
          const subLeaks = scanForLeaks(await drawer.innerText())
          if (subLeaks.length) { findings.push(`${nav} / ${label} / ${subLabel}: ${subLeaks.join(' | ')}`); entityFailed = true; break }
        }
      }
    }
    await page.keyboard.press('Escape'); await sleep(300)
  }
  expect(findings.length === 0, findings.join('\n    '))
}
