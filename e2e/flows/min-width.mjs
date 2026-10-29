/**
 * Smoke flow: the below-desktop notice (ONIX N-013). Under 1024px the slim
 * MinWidthNotice shows on the dashboard and on a list page; dismissing it holds
 * for the session (sessionStorage) across a reload; at 1280px it is absent and the
 * page has no horizontal scroll. No AI endpoint is involved (API-CREDITS-1 safe).
 */
import { go, expect, sleep } from '../lib.mjs'

// The notice is the status region that carries the 1.024 px threshold (nl copy, 1024 formatted).
const notice = (page) => page.locator('[role="status"]', { hasText: /1\.024/ })

export async function minWidth({ page }) {
  // 800px: shown on the dashboard and on candidates.
  await page.setViewportSize({ width: 800, height: 900 })
  await page.reload(); await sleep(1500)
  expect((await notice(page).count()) > 0, '800px: notice missing on the dashboard')
  await go(page, 'Kandidaten')
  expect((await notice(page).count()) > 0, '800px: notice missing on candidates')

  // Dismiss holds across a reload in the same session.
  await notice(page).first().locator('button').first().click()
  await sleep(400)
  expect((await notice(page).count()) === 0, '800px: notice still visible after dismiss')
  await page.reload(); await sleep(1500)
  expect((await notice(page).count()) === 0, '800px: dismissed notice came back after reload')

  // 375 / 768: the notice is shown (fresh session flag) — the contract allows notice OR no horizontal scroll.
  for (const width of [375, 768]) {
    await page.evaluate(() => window.sessionStorage.removeItem('km_min_width_dismissed'))
    await page.setViewportSize({ width, height: 900 })
    await page.reload(); await sleep(1500)
    expect((await notice(page).count()) > 0, `${width}px: notice missing`)
  }

  // 1280px: no notice, no horizontal scroll.
  await page.evaluate(() => window.sessionStorage.removeItem('km_min_width_dismissed'))
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.reload(); await sleep(1500)
  expect((await notice(page).count()) === 0, '1280px: notice must be absent')
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
  expect(!overflow, '1280px: horizontal scroll present')
}
