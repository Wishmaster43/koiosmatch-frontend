/**
 * Locale parity guard (§5: every user-facing key exists in ALL shipped locales).
 * nl is the reference; en/de/fr/es must contain every nl key. This makes an
 * out-of-parity locale a failing test instead of a silent Dutch/English island —
 * "half-translated is worse than untranslated" must never regress again.
 *
 * Loads the JSON via Vite's import.meta.glob (no node fs) so tsc and vitest agree.
 */
import { describe, it, expect } from 'vitest'

type Json = { [k: string]: unknown }

// Flatten a nested translation object to dotted key paths (arrays are leaves).
const flat = (o: Json, pre = ''): string[] =>
  Object.entries(o).flatMap(([k, v]) =>
    v && typeof v === 'object' && !Array.isArray(v) ? flat(v as Json, pre + k + '.') : [pre + k])

// Every locale JSON, keyed by its path './locales/<loc>/<file>.json'.
const modules = import.meta.glob('./locales/*/*.json', { eager: true, import: 'default' }) as Record<string, Json>

const REF = 'nl'
const TARGETS = ['en', 'de', 'fr', 'es'] as const

// Group the loaded modules by locale → file.
const byLoc: Record<string, Record<string, Json>> = {}
for (const [p, mod] of Object.entries(modules)) {
  const m = p.match(/\/locales\/([^/]+)\/([^/]+)$/)
  if (!m) continue
  ;(byLoc[m[1]] ??= {})[m[2]] = mod
}

// Read the string at a dotted key path (undefined when the leaf is not a string).
const valueAt = (o: Json, path: string): string | undefined => {
  const v = path.split('.').reduce<unknown>((acc, k) => (acc && typeof acc === 'object' ? (acc as Json)[k] : undefined), o)
  return typeof v === 'string' ? v : undefined
}

// The interpolation placeholders a string carries: {{count}}, {{date}}, … The SET must
// match the reference — word order may differ per language, the variables may not.
const placeholders = (s: string): string[] => (s.match(/\{\{\s*[\w.]+\s*\}\}/g) ?? [])
  .map(p => p.replace(/[{}\s]/g, '')).sort()

// Single-brace tokens ({kandidaat}, {vacature}, …) are matched by a regex on those
// literal Dutch names in the propose/rejection templates — translating one silently
// breaks interpolation, so they must be identical in every locale.
const TEMPLATE_TOKENS = /\{(kandidaat|vacature|klant|contact|recruiter)\}/g

// Keys whose {{…}} are ILLUSTRATIVE EXAMPLES inside explanatory copy, not interpolation
// variables — so each locale may (and should) show them in its own language. Verified
// 2026-07-27: the vacancy-generation template is handed to the language model as
// guidance ("vul {{placeholders}} met de velden", VacancyGenerator.php:86); nothing does
// a literal replace on those names. Keep this list tiny and always say why.
const EXAMPLE_ONLY_KEYS = new Set(['vacancyGenerationSettings.templateHint'])

describe('i18n locale parity', () => {
  const refFiles = byLoc[REF] ?? {}
  for (const file of Object.keys(refFiles)) {
    const refKeys = flat(refFiles[file])
    for (const loc of TARGETS) {
      it(`${loc}/${file} contains every ${REF} key`, () => {
        const target = byLoc[loc]?.[file]
        expect(target, `${loc}/${file} is missing entirely`).toBeTruthy()
        const keys = new Set(flat(target ?? {}))
        const missing = refKeys.filter(k => !keys.has(k))
        expect(missing, `missing in ${loc}/${file}: ${missing.join(', ')}`).toEqual([])
      })

      // Added 2026-07-27 with the de/fr/es translation sweep: a dropped or renamed
      // {{placeholder}} renders a broken sentence ("Al maanden geen contact") that no
      // other test would catch, and a translated {token} breaks the template engine.
      it(`${loc}/${file} keeps every interpolation variable`, () => {
        const target = byLoc[loc]?.[file] ?? {}
        const broken: string[] = []
        for (const key of refKeys) {
          const ref = valueAt(refFiles[file], key)
          const val = valueAt(target, key)
          if (ref === undefined || val === undefined || EXAMPLE_ONLY_KEYS.has(key)) continue
          const want = placeholders(ref).join(',')
          const got = placeholders(val).join(',')
          if (want !== got) broken.push(`${key}: expected {{${want}}} got {{${got}}}`)
          const refTokens = (ref.match(TEMPLATE_TOKENS) ?? []).sort().join(',')
          const valTokens = (val.match(TEMPLATE_TOKENS) ?? []).sort().join(',')
          if (refTokens !== valTokens) broken.push(`${key}: template tokens ${refTokens} became ${valTokens}`)
        }
        expect(broken, `interpolation drift in ${loc}/${file}:\n${broken.join('\n')}`).toEqual([])
      })
    }
  }
})
