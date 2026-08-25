/**
 * probe-seed-labels — EXACT translation check (LOOKUP-I18N-1). Instead of guessing with
 * Dutch marker words, it takes the 250+ seeded Dutch lookup labels straight from
 * src/lib/lookupSeedCatalogue.ts and reports every page that still renders one while the
 * UI is in another language. A hit is a finding by definition: that text is OUR seed, not
 * tenant content. Read-only, never touches an AI endpoint (API-CREDITS-1).
 *   PROBE_LANG=en node e2e/probe-seed-labels.mjs > findings.json
 */
import fs from 'node:fs'
import { chromium } from 'playwright'

const APP = process.env.SMOKE_APP ?? 'http://localhost:5173'
const CREDS = { email: process.env.SMOKE_EMAIL ?? 'danny@koios.nl', password: process.env.SMOKE_PASSWORD ?? 'password123' }
const LANG = process.env.PROBE_LANG ?? 'en'

// WHAT COUNTS AS A FINDING — derived per language from the locale files themselves, so
// there is no hand-maintained ignore list to drift (a global ignore once made a genuinely
// untranslated word unreportable in three languages). A seed label whose translation in
// the target language IS the Dutch word (a cognate like "Kandidaten" in German, a brand,
// an EU licence code, a Dutch qualification name) carries no information when we meet it
// on screen. Only labels whose translation actually differs can prove anything.
const seedsOf = (loc) => JSON.parse(fs.readFileSync(new URL(`../src/i18n/locales/${loc}/common.json`, import.meta.url), 'utf8')).lookupSeeds ?? {}
const NL_SEEDS = seedsOf('nl')
const TARGET_SEEDS = seedsOf(LANG)
const LABELS = [...new Set(
  Object.entries(NL_SEEDS).flatMap(([family, keys]) =>
    Object.entries(keys)
      .filter(([key, dutch]) => (TARGET_SEEDS[family]?.[key] ?? dutch) !== dutch)
      .map(([, dutch]) => dutch)),
)].filter(l => l.length > 3)

const NAV = ['dashboard', 'candidates', 'applications', 'vacancies', 'matches', 'opportunities', 'tasks', 'outreach', 'customers', 'planning', 'aiagents', 'whatsapp', 'reports']
const registry = fs.readFileSync(new URL('../src/pages/settings/registry.jsx', import.meta.url), 'utf8')
const SETTINGS = []
for (const m of registry.matchAll(/key:\s*'([a-z_]+)'[\s\S]*?items:\s*\[([\s\S]*?)\n\s*\]/g)) {
  for (const id of m[2].matchAll(/\bid:\s*'([a-z_]+)'/g)) SETTINGS.push(`settings/${m[1]}/${id[1]}`)
}
// Settings lookup EDITORS legitimately show the stored Dutch value (you edit that text).
const EDITOR_PAGES = /settings\/(candidate|customers|contacts|applications|vacancies|tasks|matches|outreach|note_types|document_types|personalisation|opportunities|planning|appointments)\/|settings\/whatsapp\/wa_message_types/

const browser = await chromium.launch()
const page = await browser.newPage()
await page.addInitScript(([t, l]) => { localStorage.setItem('active_tenant', t); localStorage.setItem('km-language', l) }, ['demo', LANG])
await page.goto(`${APP}/`, { waitUntil: 'networkidle' })
await page.fill('#login-email', CREDS.email)
await page.fill('input[type="password"]', CREDS.password)
await page.click('button[type="submit"]')
await page.waitForTimeout(2500)

const findings = []
async function scan(hash, editor) {
  await page.evaluate(h => { window.location.hash = h }, '#' + hash)
  await page.waitForTimeout(hash.startsWith('settings') ? 1100 : 1900)
  // Compare WHOLE rendered values, never substrings: a customer called "Bakker Logistiek"
  // or a task titled "Belafspraak met opdrachtgever" is tenant content, not a lookup label.
  // Every text node is split on the separators the app uses to join lookup values in one
  // cell (comma, middot, pipe, slash), and each part must match a seed label exactly.
  const values = await page.evaluate(() => {
    const out = new Set()
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const raw = (n.nodeValue || '').trim()
      if (!raw || raw.length > 120) continue
      out.add(raw)
      for (const part of raw.split(/\s*[,·|/]\s*/)) { const p = part.trim(); if (p) out.add(p) }
    }
    // Placeholders and titles/aria are rendered text too, and they hide the same defect.
    for (const el of document.querySelectorAll('[placeholder],[title],[aria-label]')) {
      for (const a of ['placeholder', 'title', 'aria-label']) {
        const v = (el.getAttribute(a) || '').trim()
        if (v && v.length <= 120) out.add(v)
      }
    }
    return [...out]
  })
  const present = new Set(values)
  // One documented exception, page-scoped (never global): the company language picker
  // lists every app language under its OWN name (Nederlands / English / Deutsch / …),
  // which is how a language picker is supposed to read, so those endonyms are not a
  // translation defect even though the same words exist as `languages` lookup values.
  const ENDONYMS = new Set(['Nederlands', 'Deutsch', 'Frans', 'Spaans', 'Engels'])
  const hits = LABELS.filter(l => present.has(l) && !(hash === 'settings/company/company' && ENDONYMS.has(l)))
  if (hits.length) findings.push({ page: '#' + hash, editor, hits })
  console.error(`${hash}: ${hits.length} seeded Dutch labels${editor ? ' (editor page, expected)' : ''}`)
}
for (const id of NAV) await scan(id, false)
for (const s of SETTINGS) await scan(s, EDITOR_PAGES.test(s))
await browser.close()
const real = findings.filter(f => !f.editor)
process.stdout.write(JSON.stringify({ labelCount: LABELS.length, findings, realFindings: real }, null, 1))
