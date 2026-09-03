/**
 * describeChangelog — CHANGELOG-DESC-I18N-1: a key-shaped description ("lookup.
 * reordered") translates; a legacy Dutch literal, and an unknown-but-key-shaped
 * string, both render unchanged.
 */
import { describe, it, expect } from 'vitest'
import type { TFunction } from 'i18next'
import { describeChangelog } from './changelogDescription'

// Minimal t() stub mirroring i18next's { defaultValue } contract, no full i18n init needed.
const makeT = (dict: Record<string, string>) =>
  ((key: string, opts?: { defaultValue?: string }) => dict[key] ?? opts?.defaultValue ?? key) as unknown as TFunction

describe('describeChangelog', () => {
  it('translates a known key-shaped description', () => {
    const t = makeT({ 'common:changelogDescriptions.lookup.reordered': 'Volgorde gewijzigd' })
    expect(describeChangelog('lookup.reordered', t)).toBe('Volgorde gewijzigd')
  })

  it('leaves a legacy Dutch literal unchanged', () => {
    const t = makeT({})
    expect(describeChangelog('Dossier geopend', t)).toBe('Dossier geopend')
  })

  it('leaves an unknown key-shaped description unchanged (no matching translation)', () => {
    const t = makeT({})
    expect(describeChangelog('some.unmapped_key', t)).toBe('some.unmapped_key')
  })

  it('passes through null/undefined', () => {
    const t = makeT({})
    expect(describeChangelog(null, t)).toBeNull()
    expect(describeChangelog(undefined, t)).toBeUndefined()
  })

  it('does not treat a plain sentence (no dot) as a key', () => {
    const t = makeT({})
    expect(describeChangelog('PDOK-geocode aangevraagd', t)).toBe('PDOK-geocode aangevraagd')
  })
})
