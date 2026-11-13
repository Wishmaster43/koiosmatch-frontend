/**
 * describeChangelog — CHANGELOG-DESC-I18N-1: a key-shaped description ("lookup.
 * reordered") translates; a legacy Dutch literal, and an unknown-but-key-shaped
 * string, both render unchanged.
 */
import { describe, it, expect } from 'vitest'
import type { TFunction } from 'i18next'
import { describeChangelog } from './changelogDescription'

// Minimal key-echo t() stub: the dictionary value when present, else the key itself; no full i18n init needed.
const makeT = (dict: Record<string, string>) =>
  ((key: string) => dict[key] ?? key) as unknown as TFunction

// Checker stub over the same dictionary: a key exists when 'ns:key' is in the dict.
const makeI18n = (dict: Record<string, string>) => ({ exists: (key: string, o?: { ns?: string }) => `${o?.ns}:${key}` in dict })

describe('describeChangelog', () => {
  it('translates a known key-shaped description', () => {
    const dict = { 'common:changelogDescriptions.lookup.reordered': 'translated.lookup.reordered' }
    const t = makeT(dict)
    expect(describeChangelog('lookup.reordered', t, makeI18n(dict))).toBe('translated.lookup.reordered')
  })

  it('leaves a legacy Dutch literal unchanged', () => {
    const t = makeT({})
    expect(describeChangelog('Dossier geopend', t, makeI18n({}))).toBe('Dossier geopend')
  })

  it('leaves an unknown key-shaped description unchanged (no matching translation)', () => {
    const t = makeT({})
    expect(describeChangelog('some.unmapped_key', t, makeI18n({}))).toBe('some.unmapped_key')
  })

  it('passes through null/undefined', () => {
    const t = makeT({})
    expect(describeChangelog(null, t, makeI18n({}))).toBeNull()
    expect(describeChangelog(undefined, t, makeI18n({}))).toBeUndefined()
  })

  it('does not treat a plain sentence (no dot) as a key', () => {
    const t = makeT({})
    expect(describeChangelog('PDOK-geocode aangevraagd', t, makeI18n({}))).toBe('PDOK-geocode aangevraagd')
  })
})
