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
    }
  }
})
