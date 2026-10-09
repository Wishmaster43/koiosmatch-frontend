/**
 * probe-catalog-labels — guards ONIX N-009: every label/help key the BE settings catalogue
 * and signal catalogue name must resolve in all seven src/i18n/locales/<lc>/settings.json.
 * GET-only (a route guard aborts every other method after boot; API-CREDITS-1).
 *   node e2e/probe-catalog-labels.mjs   (exit 1 when any key is missing)
 */
import fs from 'node:fs'
import { boot } from './lib.mjs'

const LOCALES = ['nl', 'en', 'de', 'fr', 'es', 'it', 'pt']
const { browser, page } = await boot({ tenant: 'yesway' })
// Abort anything that is not a GET so the probe can never mutate or reach an AI endpoint.
await page.route('**/*', (route) => (route.request().method() === 'GET' ? route.continue() : route.abort()))

// Fetch inside the page so the session cookie and tenant header ride along.
const fetchJson = (ep) => page.evaluate(async (e) => {
  const res = await fetch(`/api${e}`, { credentials: 'include', headers: { Accept: 'application/json' } })
  return res.ok ? res.json() : { __status: res.status }
}, ep)
const catalog = await fetchJson('/settings/catalog')
const signals = await fetchJson('/settings/signal-catalog')
await browser.close()
if (catalog.__status || signals.__status) { console.error('catalog fetch failed', catalog.__status, signals.__status); process.exit(2) }

// Collect keys as paths inside settings.json (label keys keep their literal "settings." root).
const keys = new Set()
// Section titles render only as a heading/empty-state in some host modes: reported, never failing.
const advisory = new Set()
const ns = (k) => String(k)
for (const section of catalog.data?.sections ?? []) {
  if (section.hidden) continue
  // Pattern rows describe key families and dedicated rows have their own screen: the generic screen skips both.
  const rows = (section.keys ?? []).filter((r) => r.ui === 'generic' && !r.pattern)
  if (rows.length) advisory.add(`catalog.sections.${section.id}.title`)
  for (const row of rows) {
    if (row.label_key) keys.add(ns(row.label_key))
    if (row.help_key) keys.add(ns(row.help_key))
    if (row.group_label_key) keys.add(ns(row.group_label_key))
    else if (row.group) keys.add(`settings.groups.${row.group}`)
  }
}
const sigList = signals.data?.signals ?? signals.signals ?? []
for (const s of sigList) { keys.add(`escalation.signal.${s}.title`); keys.add(`escalation.signal.${s}.desc`) }

// Resolve a dotted path, falling back to a flat key at each level.
const resolve = (obj, path) => {
  if (obj && typeof obj === 'object' && path in obj) return obj[path]
  const i = path.indexOf('.')
  for (let at = i; at !== -1; at = path.indexOf('.', at + 1)) {
    const head = path.slice(0, at)
    if (obj && typeof obj === 'object' && head in obj) {
      const r = resolve(obj[head], path.slice(at + 1))
      if (r !== undefined) return r
    }
  }
  return undefined
}
let missing = 0
for (const lc of LOCALES) {
  const json = JSON.parse(fs.readFileSync(new URL(`../src/i18n/locales/${lc}/settings.json`, import.meta.url), 'utf8'))
  const miss = [...keys].filter((k) => typeof resolve(json, k) !== 'string')
  const soft = [...advisory].filter((k) => typeof resolve(json, k) !== 'string')
  missing += miss.length
  console.log(`${lc}: ${miss.length} missing${miss.length ? '\n  ' + miss.join('\n  ') : ''}`)
  if (soft.length) console.log(`  advisory (section titles): ${soft.join(', ')}`)
}
console.log(`checked ${keys.size} keys x ${LOCALES.length} locales`)
process.exitCode = missing ? 1 : 0
