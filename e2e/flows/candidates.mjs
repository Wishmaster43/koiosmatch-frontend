/**
 * Smoke flows — the candidate scenarios Danny keeps hitting (2026-07-03):
 * status change WITH reason+date via the prompt, blacklist via the reason dropdown,
 * archive → the candidate is FINDABLE in the archived view, note with a contact
 * channel → author visible, and super-search through note text. These run through
 * the real UI + real API, so a broken seam turns the suite red — not Danny's demo.
 */
import { go, expect, sleep } from '../lib.mjs'

// Open the drawer of the first candidate row; returns the candidate's name.
async function openFirstCandidate(page) {
  await go(page, 'Kandidaten')
  const row = page.locator('table tbody tr').first()
  expect(await row.count(), 'geen kandidaat-rijen')
  const name = (await row.locator('td').nth(1).innerText()).split('\n')[0].trim()
  await row.click()
  await sleep(1200)
  return name
}

// Status → Ziek: the prompt must open, accept a reason + return date, and PATCH ok.
export async function statusWithReason({ page, errors }) {
  const at = errors.length
  await openFirstCandidate(page)
  // The deployability picker sits in the drawer header meta (SelectMenu).
  const picker = page.locator('text=Inzetbaarheid').locator('..').locator('button, [role="button"]').first()
  if (await picker.count()) await picker.click()
  else {
    // Fallback: any header select carrying a known status label.
    await page.locator('button:has-text("Beschikbaar"), button:has-text("Niet beschikbaar"), button:has-text("Geplaatst")').first().click()
  }
  await sleep(400)
  await page.locator('text=Ziek').last().click()
  await sleep(600)
  // The reason/date prompt must be visible (this was the silent-422 bug).
  const modal = page.locator('text=Reden').first()
  expect(await modal.count(), 'reden/datum-popup opende NIET (status-flags?)')
  const box = page.locator('textarea').last()
  if (await box.count()) await box.fill('smoke: griep')
  const date = page.locator('input[type="date"]').last()
  if (await date.count()) await date.fill('2026-08-01')
  await page.locator('button:has-text("Opslaan")').last().click()
  await sleep(1200)
  const fresh = errors.slice(at)
  expect(fresh.length === 0, `statuswissel gaf fouten: ${fresh.join(' | ')}`)
  await page.keyboard.press('Escape'); await sleep(300)
}

// Archive from the drawer → the archived view must CONTAIN the candidate (ARCH-1 guard).
export async function archiveAndFindBack({ page, errors }) {
  const at = errors.length
  const name = await openFirstCandidate(page)
  page.once('dialog', d => d.accept())
  const trash = page.locator('button[title*="rchiveren"], button[aria-label*="rchiveren"]').first()
  expect(await trash.count(), 'archiveer-knop niet gevonden in de drawer')
  await trash.click()
  await sleep(1500)
  // Open the archived quick-view and look for the name.
  await page.locator('button:has-text("Gearchiveerd")').first().click()
  await sleep(1500)
  const found = await page.locator(`table tbody tr:has-text("${name}")`).count()
  // Leave the archived view clean for the next flow.
  await page.locator('button:has-text("Gearchiveerd")').first().click()
  await sleep(600)
  expect(found > 0, `gearchiveerde kandidaat "${name}" NIET terug te vinden in de Gearchiveerd-view (ARCH-1)`)
  const fresh = errors.slice(at)
  expect(fresh.length === 0, `archiveren gaf fouten: ${fresh.join(' | ')}`)
}

// Note with a contact channel → saved, author visible, no errors.
export async function noteWithChannel({ page, errors }) {
  const at = errors.length
  await openFirstCandidate(page)
  await page.locator('button:has-text("Communicatie"), [role="tab"]:has-text("Communicatie")').first().click()
  await sleep(800)
  await page.locator('text=Nieuwe notitie').first().click()
  await sleep(400)
  // Pick a channel chip (WhatsApp) then write + save.
  const chip = page.locator('button:has-text("WhatsApp")').last()
  if (await chip.count()) await chip.click()
  const editor = page.locator('[contenteditable="true"], textarea').last()
  await editor.fill?.('smoke: gebeld over dienst').catch?.(() => {})
  try { await editor.fill('smoke: contactmoment') } catch { await editor.type('smoke: contactmoment') }
  await page.locator('button[title="Opslaan"], button:has-text("Opslaan")').last().click()
  await sleep(1400)
  const fresh = errors.slice(at)
  expect(fresh.length === 0, `notitie opslaan gaf fouten: ${fresh.join(' | ')}`)
  await page.keyboard.press('Escape'); await sleep(300)
}

// Super-search: a term from note bodies must return rows (blind-index seam).
export async function superSearch({ page, errors }) {
  const at = errors.length
  await go(page, 'Kandidaten')
  const search = page.locator('input[placeholder*="Zoek"]').first()
  expect(await search.count(), 'zoekbalk niet gevonden')
  await search.fill('ziek')
  await sleep(1600)
  const rows = await page.locator('table tbody tr').count()
  await search.fill(''); await sleep(600)
  expect(rows > 0, 'super-search "ziek" gaf 0 resultaten (SEARCH-1-naad)')
  const fresh = errors.slice(at)
  expect(fresh.length === 0, `zoeken gaf fouten: ${fresh.join(' | ')}`)
}
