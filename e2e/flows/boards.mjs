/**
 * Smoke flow: every kanban board — switch to board view, drag a card CROSS-column
 * with real DragEvents, and verify the PATCH fires, no cards vanish and no errors.
 */
import { go, expect, sleep } from '../lib.mjs'

const BOARDS = ['Sollicitaties', 'Kansen', 'Taken', 'Bellijsten']

export async function boardsDrag({ page, errors }) {
  const failures = []
  for (const nav of BOARDS) {
    const at = errors.length
    await go(page, nav)
    const toggle = page.locator('button[title*="anban"], button[title*="oard"], button[title*="ord"]').first()
    if (!(await toggle.count())) { failures.push(`${nav}: geen board-toggle`); continue }
    await toggle.click(); await sleep(1200)
    const before = await page.locator('[draggable="true"]').count()
    if (before === 0) { failures.push(`${nav}: leeg board`); continue }
    // Cross-column drop via native DragEvents (React catches them on the column div).
    let patched = false
    const onReq = (r) => { if (r.method() === 'PATCH' && r.url().includes('/api/')) patched = true }
    page.on('request', onReq)
    const crossable = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('[draggable="true"]')].map(c => ({ el: c, x: Math.round(c.getBoundingClientRect().x) }))
      const src = cards[0]
      const other = cards.find(c => Math.abs(c.x - src.x) > 120)
      const dt = new DataTransfer()
      const fire = (el, type) => el.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt }))
      fire(src.el, 'dragstart')
      if (other) { fire(other.el, 'dragover'); fire(other.el, 'drop') }
      fire(src.el, 'dragend')
      return !!other
    })
    await sleep(1400)
    page.off('request', onReq)
    const after = await page.locator('[draggable="true"]').count()
    if (after < before - 1) failures.push(`${nav}: kaarten verdwenen (${before}→${after})`)
    // All cards in one column = nothing to cross-drop; a skipped drag is not a failure.
    if (!patched && crossable) failures.push(`${nav}: geen PATCH gevuurd na drop`)
    if (!crossable) console.log(`   (${nav}: 1 kolom bezet — drag overgeslagen)`)
    const fresh = errors.slice(at)
    if (fresh.length) failures.push(`${nav}: ${fresh.join(' | ')}`)
  }
  expect(failures.length === 0, failures.join('\n    '))
}
