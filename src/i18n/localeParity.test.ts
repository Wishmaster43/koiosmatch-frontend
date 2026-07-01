/**
 * Locale parity guard (§5: every user-facing key exists in ALL shipped locales).
 * nl is the reference; en/de/fr/es must contain every nl key. This makes an
 * out-of-parity locale a failing test instead of a silent Dutch/English island —
 * "half-translated is worse than untranslated" must never regress again.
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const LOCALES_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'locales')
const REF = 'nl'
const TARGETS = ['en', 'de', 'fr', 'es'] as const

// Flatten a nested translation object to dotted key paths (arrays are leaves).
type Json = { [k: string]: unknown }
const flat = (o: Json, pre = ''): string[] =>
  Object.entries(o).flatMap(([k, v]) =>
    v && typeof v === 'object' && !Array.isArray(v) ? flat(v as Json, pre + k + '.') : [pre + k])

const load = (loc: string, file: string): Json =>
  JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, loc, file), 'utf8'))

describe('i18n locale parity', () => {
  const files = fs.readdirSync(path.join(LOCALES_DIR, REF)).filter(f => f.endsWith('.json'))

  for (const file of files) {
    const refKeys = flat(load(REF, file))
    for (const loc of TARGETS) {
      it(`${loc}/${file} contains every ${REF} key`, () => {
        const keys = new Set(flat(load(loc, file)))
        const missing = refKeys.filter(k => !keys.has(k))
        expect(missing, `missing in ${loc}/${file}: ${missing.join(', ')}`).toEqual([])
      })
    }
  }
})
