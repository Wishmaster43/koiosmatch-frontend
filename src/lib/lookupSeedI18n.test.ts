/**
 * lookupSeedI18n — LOOKUP-I18N-1. The whole point of this module is the boundary
 * between OUR text and THEIRS: a seeded product default may be translated, a value the
 * tenant created or renamed may not. These tests pin that boundary in both directions,
 * for both keying schemes (stable slug and uuid-with-label).
 */
import { describe, it, expect } from 'vitest'
import { seedKeyFor, labelKey, translateSeedLabel, translateSeedList } from './lookupSeedI18n'
import { SEED_LABELS, LABEL_KEYED, SEED_LABEL_KEYS } from './lookupSeedCatalogue'
import nlCommon from '../i18n/locales/nl/common.json'
import enCommon from '../i18n/locales/en/common.json'
import deCommon from '../i18n/locales/de/common.json'
import frCommon from '../i18n/locales/fr/common.json'
import esCommon from '../i18n/locales/es/common.json'
import itCommon from '../i18n/locales/it/common.json'
import ptCommon from '../i18n/locales/pt/common.json'

// The eight OpenCage geocoding-template workflowNames labels: seeded in the TS catalogue
// but never given a translation key in any locale (a pre-existing gap, not a rename miss).
const UNTRANSLATED_WORKFLOW_NAMES = [
  'Adres geocoderen (OpenCage)',
  'Adressen geocoderen, bulk (OpenCage)',
  'Klantadres geocoderen (OpenCage)',
  'Klantadressen geocoderen, bulk (OpenCage)',
  'Locatieadres geocoderen (OpenCage)',
  'Locatieadressen geocoderen, bulk (OpenCage)',
  'Vacatureadres geocoderen (OpenCage)',
  'Vacatureadressen geocoderen, bulk (OpenCage)',
]

const LOCALES: Record<string, unknown> = { nl: nlCommon, en: enCommon, de: deCommon, fr: frCommon, es: esCommon, it: itCommon, pt: ptCommon }

// Stand-in for i18next: returns a marker so a translated value is unmistakable.
const t = (key: string) => `T:${key}`

describe('seedKeyFor — slug-keyed families (the value is the key)', () => {
  it('resolves a seeded default that still carries its seeded label', () => {
    expect(seedKeyFor('statuses', { value: 'available', label: 'Beschikbaar' })).toBe('available')
  })

  it('refuses a RENAMED seeded value, so the tenant keeps their own word', () => {
    expect(seedKeyFor('statuses', { value: 'available', label: 'Inzetbaar' })).toBeNull()
  })

  it('refuses a value the tenant added themselves', () => {
    expect(seedKeyFor('statuses', { value: 'sabbatical', label: 'Sabbatical' })).toBeNull()
  })

  it('ignores case, accents and outer spacing when deciding "unchanged"', () => {
    expect(seedKeyFor('statuses', { value: 'available', label: '  beschikbaar ' })).toBe('available')
  })
})

describe('seedKeyFor — label-keyed families (the row carries only a uuid)', () => {
  it('resolves through the seeded Dutch label to its SEED-KEYS-EN-1 English key', () => {
    // SEED-KEYS-EN-1: the key name is now the English translation, not labelKey(dutch label).
    const oldStyleKey = labelKey('Niet gekwalificeerd')
    expect(SEED_LABELS.rejectionReasons[oldStyleKey]).toBe('Niet gekwalificeerd')
    const englishKey = SEED_LABEL_KEYS.rejectionReasons['Niet gekwalificeerd']
    expect(englishKey).toBeTruthy()
    expect(seedKeyFor('rejectionReasons', { value: '01a03913-e812-4c4d-9f0a-000000000000', label: 'Niet gekwalificeerd' })).toBe(englishKey)
  })

  it('refuses a renamed row, because the new label is not in the catalogue', () => {
    expect(seedKeyFor('rejectionReasons', { value: '01a03913-e812-4c4d-9f0a-000000000000', label: 'Te weinig ervaring' })).toBeNull()
  })

  it('resolves through the CANONICAL seed label even when the row label is not byte-identical', () => {
    // Outer spaces here: the row still matches via normalise(), and must resolve the
    // English key via the canonical catalogue label, not the raw (spaced) row label.
    const englishKey = SEED_LABEL_KEYS.rejectionReasons['Niet gekwalificeerd']
    expect(seedKeyFor('rejectionReasons', { value: '01a03913-e812-4c4d-9f0a-000000000000', label: ' Niet gekwalificeerd ' })).toBe(englishKey)
  })

  it('falls back to labelKey() for a seeded label outside the SEED_LABEL_KEYS map', () => {
    // workflowNames' OpenCage geocoding templates are seeded but never got a map entry
    // (the pre-existing gap) — this actually exercises the fallback branch, unlike an
    // unseeded label, which returns null before the map is even consulted.
    const label = 'Adres geocoderen (OpenCage)'
    expect(SEED_LABEL_KEYS.workflowNames[label]).toBeUndefined()
    expect(seedKeyFor('workflowNames', { label })).toBe(labelKey(label))
  })
})

describe('SEED_LABEL_KEYS — the English key map (SEED-KEYS-EN-1)', () => {
  it('covers every SEED_LABELS label except the named untranslated workflowNames templates', () => {
    const missing: string[] = []
    for (const family of LABEL_KEYED) {
      const keys = SEED_LABEL_KEYS[family] ?? {}
      const seeds = SEED_LABELS[family] ?? {}
      for (const label of Object.values(seeds)) {
        if (family === 'workflowNames' && UNTRANSLATED_WORKFLOW_NAMES.includes(label)) continue
        if (!keys[label]) missing.push(`${family}: ${label}`)
      }
    }
    expect(missing, `seed labels missing a SEED_LABEL_KEYS entry:\n${missing.join('\n')}`).toEqual([])
  })

  it('has no duplicate English keys within a family', () => {
    for (const family of LABEL_KEYED) {
      const values = Object.values(SEED_LABEL_KEYS[family] ?? {})
      const dupes = values.filter((v, i) => values.indexOf(v) !== i)
      expect(dupes, `duplicate English keys in ${family}: ${dupes.join(', ')}`).toEqual([])
    }
  })

  it('every mapped key resolves to a real lookupSeeds translation in ALL SEVEN locales', () => {
    const missing: string[] = []
    for (const family of LABEL_KEYED) {
      const keys = Object.values(SEED_LABEL_KEYS[family] ?? {})
      for (const [locale, json] of Object.entries(LOCALES)) {
        const bucket = (json as { lookupSeeds?: Record<string, Record<string, string>> }).lookupSeeds?.[family] ?? {}
        for (const key of keys) {
          if (!(key in bucket)) missing.push(`${locale}: lookupSeeds.${family}.${key}`)
        }
      }
    }
    expect(missing, `SEED_LABEL_KEYS entries missing a locale translation:\n${missing.join('\n')}`).toEqual([])
  })

  it('every value equals labelKey(en translation), with a _N suffix only on a real collision', () => {
    const en = enCommon as { lookupSeeds?: Record<string, Record<string, string>> }
    const broken: string[] = []
    for (const family of LABEL_KEYED) {
      const keys = SEED_LABEL_KEYS[family] ?? {}
      const bucket = en.lookupSeeds?.[family] ?? {}
      // Track how many times each base labelKey() has been assigned, to verify the
      // collision-numbering rule (first occurrence bare, next _2, next _3, ...).
      const seenBase: Record<string, number> = {}
      for (const [dutchLabel, key] of Object.entries(keys)) {
        const enValue = bucket[key]
        if (enValue === undefined) continue // covered by the locale-coverage test above
        const base = labelKey(enValue)
        seenBase[base] = (seenBase[base] ?? 0) + 1
        const expected = seenBase[base] === 1 ? base : `${base}_${seenBase[base]}`
        if (key !== expected) broken.push(`${family}.${dutchLabel} -> "${key}", expected "${expected}"`)
      }
    }
    expect(broken, `keys not derived from labelKey(en value):\n${broken.join('\n')}`).toEqual([])
  })
})

describe('translateSeedLabel / translateSeedList', () => {
  it('translates a seeded default and leaves a tenant value alone', () => {
    expect(translateSeedLabel(t, 'statuses', { value: 'available', label: 'Beschikbaar' })).toBe('T:lookupSeeds.statuses.available')
    expect(translateSeedLabel(t, 'statuses', { value: 'own', label: 'Eigen waarde' })).toBe('Eigen waarde')
  })

  it('keeps the untouched row object identical, so only translated rows are new objects', () => {
    const own = { value: 'own', label: 'Eigen waarde' }
    const rows = [{ value: 'available', label: 'Beschikbaar' }, own]
    const out = translateSeedList(t, 'statuses', rows)
    expect(out[0].label).toBe('T:lookupSeeds.statuses.available')
    expect(out[1]).toBe(own)
  })

  it('passes an unknown family straight through', () => {
    expect(translateSeedLabel(t, 'notAFamily', { value: 'x', label: 'Iets' })).toBe('Iets')
  })

  it('returns the input array untouched when there is nothing to map', () => {
    const empty: { value: string; label: string }[] = []
    expect(translateSeedList(t, 'statuses', empty)).toBe(empty)
  })
})

describe('catalogue integrity', () => {
  it('every label-keyed family stores keys that its own labelKey() reproduces', () => {
    const broken: string[] = []
    for (const family of LABEL_KEYED) {
      for (const [key, label] of Object.entries(SEED_LABELS[family] ?? {})) {
        if (labelKey(label) !== key) broken.push(`${family}.${key} -> ${labelKey(label)}`)
      }
    }
    expect(broken, `catalogue keys that labelKey() cannot reproduce:\n${broken.join('\n')}`).toEqual([])
  })

  it('carries every family the app reads, with no empty family', () => {
    const empties = Object.entries(SEED_LABELS).filter(([, v]) => Object.keys(v).length === 0).map(([k]) => k)
    expect(empties).toEqual([])
    expect(Object.keys(SEED_LABELS).length).toBeGreaterThanOrEqual(39)
  })
})

describe('translateSeedList stays behaviour-identical after the key rename', () => {
  // Resolve `t` against the REAL locale JSON, so the assertions pin actual rendered
  // strings, not just the key-prefix shape.
  const makeRealT = (json: unknown) => (key: string): string => {
    const parts = key.split('.')
    let node: unknown = json
    for (const part of parts) {
      node = (node as Record<string, unknown> | undefined)?.[part]
    }
    return typeof node === 'string' ? node : key
  }
  const tEn = makeRealT(enCommon)
  const tDe = makeRealT(deCommon)

  it('still resolves and translates every seeded row for three renamed families', () => {
    // SEED-KEYS-EN-1 only moved the KEY NAME; every seeded row must still translate.
    for (const family of ['rejectionReasons', 'functions', 'pools']) {
      const rows = Object.entries(SEED_LABELS[family]).map(([, label]) => ({ value: 'x', label }))
      const out = translateSeedList(t, family, rows)
      for (let i = 0; i < rows.length; i++) {
        expect(out[i].label.startsWith('T:lookupSeeds.'), `${family} row "${rows[i].label}" did not translate`).toBe(true)
      }
    }
  })

  it('renders the exact concrete en/de strings for one row of each of three families', () => {
    // Literal expectations, never `t(key)` built from the same map: a map entry pointing at
    // another row's existing key would otherwise pass unnoticed (Opus lens, 29-09).
    const cases: [string, string, string, string][] = [
      ["rejectionReasons", "Niet gekwalificeerd", "Not qualified", "Nicht qualifiziert"],
      ["functions", "Logistiek medewerker", "Logistics employee", "Logistikmitarbeiter"],
      ["pools", "Top kandidaten", "Top candidates", "Top-Kandidaten"],
    ]
    for (const [family, dutchLabel, expectedEn, expectedDe] of cases) {
      const row = { value: 'x', label: dutchLabel }
      expect(translateSeedLabel(tEn, family, row)).toBe(expectedEn)
      expect(translateSeedLabel(tDe, family, row)).toBe(expectedDe)
    }
  })
})

describe('records that embed only the flat label (no lookup value)', () => {
  it('translates a seeded default that arrives without a value', () => {
    expect(seedKeyFor('funnelTypes', { label: 'Aangenomen' })).toBe('hired')
    expect(translateSeedLabel(t, 'funnelTypes', { label: 'Aangenomen' })).toBe('T:lookupSeeds.funnelTypes.hired')
  })

  it('still refuses a tenant label that matches no seed', () => {
    expect(seedKeyFor('funnelTypes', { label: 'Tweede gesprek' })).toBeNull()
    expect(translateSeedLabel(t, 'funnelTypes', { label: 'Tweede gesprek' })).toBe('Tweede gesprek')
  })

  it('prefers the value when both are present and they disagree', () => {
    // A renamed row: the value is seeded but the label is the tenant's own word.
    expect(seedKeyFor('funnelTypes', { value: 'hired', label: 'Aan de slag' })).toBeNull()
  })
})
