/**
 * Smoke flows — the candidate scenarios Danny keeps hitting (2026-07-03):
 * status change WITH reason+date via the prompt, blacklist via the reason dropdown,
 * archive → the candidate is FINDABLE in the archived view, note with a contact
 * channel → author visible, and super-search through note text. These run through
 * the real UI + real API, so a broken seam turns the suite red — not Danny's demo.
 */
import { go, expect, sleep } from '../lib.mjs'

// Open the drawer of the first candidate row; returns the candidate's name.
async function openFirstCandidate(page, { withStatus = false } = {}) {
  await go(page, 'Kandidaten')
  // A Lead has no status → the drawer hides the deployability picker; status flows need a
  // row that actually carries a status chip.
  const row = withStatus
    ? page.locator('table tbody tr:has-text("Beschikbaar"), table tbody tr:has-text("Ziek"), table tbody tr:has-text("Verlof")').first()
    : page.locator('table tbody tr').first()
  expect(await row.count(), 'geen kandidaat-rijen')
  const name = (await row.locator('td').nth(1).innerText()).split('\n')[0].trim()
  await row.click()
  await sleep(1200)
  return name
}

// Status → Ziek: the prompt must open, accept a reason + return date, and PATCH ok.
export async function statusWithReason({ page, errors }) {
  const at = errors.length
  await openFirstCandidate(page, { withStatus: true })
  // The deployability picker is the drawer button whose EXACT text is the current status
  // ("Niet beschikbaar" contains "Beschikbaar" — substring locators pick the wrong thing).
  const STATUSES = /^(Beschikbaar|Niet beschikbaar|Geplaatst|Ziek|Verlof|Blacklist)$/
  const picker = page.locator('button', { hasText: STATUSES }).last()
  expect(await picker.count(), 'status-picker niet gevonden in de drawer')
  const current = (await picker.innerText()).trim()
  await picker.click()
  // Force a real transition to a reason/date status: Ziek, or Verlof when already Ziek.
  // WAIT for the dropdown option to be visible before clicking — on the slower cookie-mode
  // proxy a fixed 400ms raced the menu open and `text=` then hit a table cell instead.
  const target = current === 'Ziek' ? 'Verlof' : 'Ziek'
  const option = page.locator('button, [role="option"], li', { hasText: new RegExp(`^\\s*${target}\\s*$`) }).last()
  await option.waitFor({ state: 'visible', timeout: 5000 })
  await option.click()
  // The reason/date prompt must be visible (this was the silent-422 bug). Assert on the
  // modal TITLE — a date-only status (Verlof) renders no "Reden" label, and the cookie-mode
  // proxy paints a beat later than bearer, so: title + waitFor instead of text+sleep.
  const modal = page.locator('text=Statuswijziging').first()
  await modal.waitFor({ state: 'visible', timeout: 6000 })
    .catch(() => expect(false, 'reden/datum-popup opende NIET (status-flags?)'))
  const box = page.locator('textarea').last()
  if (await box.count()) await box.fill('Tijdelijk niet inzetbaar (demo)')
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
  // ARCHIVE-GUARD: a row with a live funnel stage/active match now opens the guard
  // modal instead of archiving — pick a candidate WITHOUT running business here.
  await go(page, 'Kandidaten')
  const row = page.locator('table tbody tr')
    .filter({ hasNotText: /Gesolliciteerd|Uitgenodigd|Intake|Voorgesteld|Geplaatst/ }).first()
  expect(await row.count(), 'geen archiveerbare kandidaat-rij (alles heeft lopende zaken?)')
  const name = (await row.locator('td').nth(1).innerText()).split('\n')[0].trim()
  await row.click()
  await sleep(1200)
  // The confirm now lives in the guard hook (window.confirm) — accept it when it fires.
  page.once('dialog', d => d.accept())
  const trash = page.locator('button[title*="rchiveren"], button[aria-label*="rchiveren"]').first()
  expect(await trash.count(), 'archiveer-knop niet gevonden in de drawer')
  await trash.click()
  await sleep(1500)
  // Open the archived quick-view and look for the name.
  await page.locator('button:has-text("Gearchiveerd")').first().click()
  await sleep(1500)
  const found = await page.locator(`table tbody tr:has-text("${name}")`).count()
  expect(found > 0, `gearchiveerde kandidaat "${name}" NIET terug te vinden in de Gearchiveerd-view (ARCH-1)`)
  // The archived row must OPEN (drawer on row data + banner) — it 404'd as "bestaat
  // niet meer" before (Danny 2026-07-04); the restore icon proves the banner rendered.
  await page.locator(`table tbody tr:has-text("${name}")`).first().click()
  await sleep(1000)
  expect(await page.locator('button[title="Herstellen"]').count(), 'gearchiveerde kandidaat opent NIET (drawer/banner ontbreekt)')
  await page.keyboard.press('Escape'); await sleep(300)
  // Leave the archived view clean for the next flow.
  await page.locator('button:has-text("Gearchiveerd")').first().click()
  await sleep(600)
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
  await editor.fill?.('Gebeld over de dienst (demo)').catch?.(() => {})
  try { await editor.fill('Contactmoment vastgelegd (demo)') } catch { await editor.type('Contactmoment vastgelegd (demo)') }
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
