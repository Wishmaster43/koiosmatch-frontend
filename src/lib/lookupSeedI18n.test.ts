/**
 * lookupSeedI18n — LOOKUP-I18N-1. The whole point of this module is the boundary
 * between OUR text and THEIRS: a seeded product default may be translated, a value the
 * tenant created or renamed may not. These tests pin that boundary in both directions,
 * for both keying schemes (stable slug and uuid-with-label).
 */
import { describe, it, expect } from 'vitest'
import { seedKeyFor, labelKey, translateSeedLabel, translateSeedList } from './lookupSeedI18n'
import { SEED_LABELS, LABEL_KEYED } from './lookupSeedCatalogue'

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
  it('resolves through the seeded Dutch label', () => {
    const key = labelKey('Niet gekwalificeerd')
    expect(SEED_LABELS.rejectionReasons[key]).toBe('Niet gekwalificeerd')
    expect(seedKeyFor('rejectionReasons', { value: '01a03913-e812-4c4d-9f0a-000000000000', label: 'Niet gekwalificeerd' })).toBe(key)
  })

  it('refuses a renamed row, because the new label is not in the catalogue', () => {
    expect(seedKeyFor('rejectionReasons', { value: '01a03913-e812-4c4d-9f0a-000000000000', label: 'Te weinig ervaring' })).toBeNull()
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
