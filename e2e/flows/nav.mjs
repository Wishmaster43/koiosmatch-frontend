/**
 * Smoke flows: every nav page renders without errors, and every entity list's
 * drill-down (row click → drawer with content) actually opens. Catches dead pages,
 * empty drawers and 4xx/5xx on the detail endpoints.
 */
import { go, expect, sleep } from '../lib.mjs'

const NAV_PAGES = ['Dashboard', 'Kandidaten', 'Sollicitaties', 'Vacatures', 'Matches', 'Kansen', 'Taken', 'Bellijsten', 'Klanten', 'Rapporten', 'Planning', 'AI & Workflows', 'WhatsApp']

// Every page in the sidebar renders and produces zero console/network errors.
export async function pagesRender({ page, errors }) {
  for (const nav of NAV_PAGES) {
    const at = errors.length
    await go(page, nav)
    const fresh = errors.slice(at)
    expect(fresh.length === 0, `${nav}: ${fresh.join(' | ')}`)
  }
}

// Row click opens a drawer that actually contains content (not an empty shell).
const DRILL_PAGES = ['Kandidaten', 'Sollicitaties', 'Vacatures', 'Matches', 'Kansen', 'Taken', 'Bellijsten', 'Klanten']

export async function drillDowns({ page, errors }) {
  const failures = []
  for (const nav of DRILL_PAGES) {
    const at = errors.length
    await go(page, nav)
    // First data row in the table body (skip the header row).
    const row = page.locator('table tbody tr').first()
    if (!(await row.count())) { failures.push(`${nav}: geen rijen`); continue }
    await row.click()
    await sleep(1200)
    // A drawer/panel appeared with a heading + some body text beyond the table itself.
    const drawerText = await page.evaluate(() => {
      // The drawers render as a right panel; take the last major section's text length.
      const candidates = [...document.querySelectorAll('div')].filter(d => d.offsetWidth > 300 && d.offsetWidth < 900 && d.offsetHeight > 400)
      const el = candidates.at(-1)
      return el ? el.innerText.length : 0
    })
    if (drawerText < 80) failures.push(`${nav}: drawer leeg/niet geopend (${drawerText} tekens)`)
    const fresh = errors.slice(at)
    if (fresh.length) failures.push(`${nav}: ${fresh.join(' | ')}`)
    // Close via Escape so the next page starts clean.
    await page.keyboard.press('Escape')
    await sleep(400)
  }
  expect(failures.length === 0, failures.join('\n    '))
}
