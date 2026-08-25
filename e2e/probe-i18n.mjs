/**
 * probe-i18n — language check against the REAL app (SCHERMWAARHEID-1): logs in,
 * switches the UI language (PROBE_LANG, default en), visits every nav page and every
 * settings section, and lists the visible lines that still read as Dutch (marker-word
 * heuristic). Tenant DATA (lookup values, names, seeded texts) is Dutch by design and
 * shows up here too — read the output as an inventory, not as a defect list. Never
 * touches AI endpoints (API-CREDITS-1). Output: JSON on stdout, per-page summary on stderr.
 *   node e2e/probe-i18n.mjs > out.json
 */
import fs from 'node:fs'
import { boot, APP, sleep } from './lib.mjs'

const NL = new Set(`de het een niet wordt worden toevoegen verwijderen opslaan annuleren bezig geen nog alle nieuwe nieuw gebruiker gebruikers vestiging vestigingen klant klanten kandidaat kandidaten vacature vacatures sollicitatie sollicitaties instellingen zoeken kies selecteer bewerken wijzigen laden mislukt opgeslagen met van voor naar bij je jouw uw deze dit hier ook als maar wel nu alleen zijn kan kunnen moet moeten dagen weken maanden jaar uur minuten naam datum tijd fase reden opmerking notitie notities bericht berichten verzonden ontvangen afgerond gesloten actief gearchiveerd overzicht rapport rapporten taak taken afspraak afspraken bellijst bellijsten werkstroom geselecteerd beschikbaar weergave wachtrij eigenaar koppelen gekoppeld ontkoppelen toegevoegd verwijderd aanmaken aangemaakt verstuur versturen verstuurd bevestigen bevestig sluiten terug volgende vorige meer minder alles niets leeg invullen verplicht optioneel verborgen ja nee onbekend geplaatst afgewezen uitgenodigd voorgesteld aangenomen ingepland gepland telefoon adres postcode plaats land functie functies contactpersoon contactpersonen afdeling afdelingen locatie locaties dienst diensten plaatsing plaatsingen wijziging wijzigingen geschiedenis`.split(/\s+/))
const isDutch = (line) => {
  const toks = line.toLowerCase().match(/[a-zà-ü]+/g) ?? []
  return toks.some(t => NL.has(t))
}

// Nav pages (sidebar ids that are plain hashes) + settings category/tab pairs parsed
// from the registry source (the probe cannot import JSX).
const NAV = ['dashboard', 'candidates', 'applications', 'vacancies', 'matches', 'opportunities', 'tasks', 'outreach', 'customers', 'planning', 'aiagents', 'whatsapp', 'reports']
const registry = fs.readFileSync(new URL('../src/pages/settings/registry.jsx', import.meta.url), 'utf8')
const SETTINGS = []
for (const m of registry.matchAll(/key:\s*'([a-z_]+)'[\s\S]*?items:\s*\[([\s\S]*?)\n\s*\]/g)) {
  for (const id of m[2].matchAll(/\bid:\s*'([a-z_]+)'/g)) SETTINGS.push([m[1], id[1]])
}

const { browser, page, errors } = await boot({ tenant: 'demo' })
// Language lives in localStorage (ThemeContext km-language) — set it and reload so i18n boots in English.
await page.evaluate(() => localStorage.setItem('km-language', 'en'))
await page.reload({ waitUntil: 'networkidle' })
await sleep(1500)

const out = []
async function capture(label) {
  const text = await page.evaluate(() => document.body.innerText)
  const lines = [...new Set(text.split('\n').map(s => s.trim()).filter(s => s.length > 1))]
  const dutch = lines.filter(isDutch)
  out.push({ page: label, lines: lines.length, dutch })
  console.error(`${label}: ${dutch.length} Dutch-looking lines of ${lines.length}`)
}
for (const id of NAV) {
  await page.evaluate(h => { window.location.hash = h }, '#' + id)
  await sleep(1800)
  await capture('#' + id)
}
// Settings: enter the shell once, then deep-link per section; record console/http
// errors per page (the shell's hash sync must not loop) and the line count so an
// unrendered section is visible as such.
await page.evaluate(() => { window.location.hash = '#settings' })
await sleep(1500)
for (const [cat, tab] of SETTINGS) {
  const before = errors.length
  await page.evaluate(h => { window.location.hash = h }, `#settings/${cat}/${tab}`)
  await sleep(1100)
  await capture(`#settings/${cat}/${tab}`)
  const fresh = errors.slice(before)
  if (fresh.length) out[out.length - 1].errors = fresh.map(e => e.slice(0, 160))
}
await browser.close()
process.stdout.write(JSON.stringify({ pages: out, errors: errors.slice(0, 40) }, null, 1))
