/**
 * mapping.test.ts — proves the auto-map suggestion, manual override (with its
 * dedup rule), the missing-required-columns check, and the payload builder that
 * turns parsed rows into the exact shape the wizard will send.
 */
import { describe, it, expect } from 'vitest'
import {
  SKIP, autoMapColumns, buildMappedRows, missingRequiredColumns, setMapping, unmappedSourceColumns,
} from './mapping'

const CUSTOMER_COLUMNS = ['naam', 'email', 'telefoon', 'plaats', 'kvk_nummer', 'btw_nummer', 'website', 'branche']

describe('autoMapColumns', () => {
  it('maps an exact (normalised) header match to its target column', () => {
    const mapping = autoMapColumns(['Naam', 'Email'], CUSTOMER_COLUMNS)
    expect(mapping.Naam).toBe('naam')
    expect(mapping.Email).toBe('email')
  })

  it('maps a synonym when the exact name is not present', () => {
    const mapping = autoMapColumns(['Company Name', 'Phone'], CUSTOMER_COLUMNS)
    expect(mapping['Company Name']).toBe('naam')
    expect(mapping.Phone).toBe('telefoon')
  })

  it('inherits the base column synonyms for a tree-prefixed target', () => {
    const mapping = autoMapColumns(['E-mail'], ['klant_naam', 'klant_email'])
    expect(mapping['E-mail']).toBe('klant_email')
  })

  it('defaults an unrecognised source column to SKIP rather than dropping it silently', () => {
    const mapping = autoMapColumns(['Naam', 'Internal Reference'], CUSTOMER_COLUMNS)
    expect(mapping['Internal Reference']).toBe(SKIP)
    expect(unmappedSourceColumns(mapping)).toEqual(['Internal Reference'])
  })

  it('never claims the same target twice for two similarly-named source columns', () => {
    const mapping = autoMapColumns(['Naam', 'Name (old)'], CUSTOMER_COLUMNS)
    // Only one of the two may end up mapped to 'naam'.
    const claimants = Object.entries(mapping).filter(([, target]) => target === 'naam')
    expect(claimants).toHaveLength(1)
  })
})

describe('setMapping', () => {
  it('overrides one source column and clears any other column that had the same target', () => {
    const initial = { ColA: 'naam', ColB: SKIP }
    const next = setMapping(initial, 'ColB', 'naam')
    expect(next.ColB).toBe('naam')
    expect(next.ColA).toBe(SKIP) // the previous owner is freed, never left double-mapped
  })

  it('setting a column to SKIP does not disturb any other mapping', () => {
    const initial = { ColA: 'naam', ColB: 'email' }
    const next = setMapping(initial, 'ColA', SKIP)
    expect(next.ColA).toBe(SKIP)
    expect(next.ColB).toBe('email')
  })
})

describe('missingRequiredColumns', () => {
  it('reports a required target with no source column mapped to it', () => {
    const mapping = { OnlyEmail: 'email' }
    expect(missingRequiredColumns(mapping, 'customers')).toEqual(['naam'])
  })

  it('reports nothing once every required column is mapped', () => {
    const mapping = { Naam: 'naam' }
    expect(missingRequiredColumns(mapping, 'customers')).toEqual([])
  })

  it('an unknown entity has no required columns to report', () => {
    expect(missingRequiredColumns({}, 'unknown_entity')).toEqual([])
  })
})

describe('buildMappedRows', () => {
  const headers = ['Naam', 'Email', 'Notitie']
  const mapping = { Naam: 'naam', Email: 'email', Notitie: SKIP }

  it('applies the mapping and trims values, dropping SKIP columns entirely', () => {
    const rows = buildMappedRows(headers, [['Acme ', ' info@acme.nl', 'ignore me']], mapping)
    expect(rows).toEqual([{ naam: 'Acme', email: 'info@acme.nl' }])
  })

  it('drops a row where every mapped cell is blank, mirroring the backend', () => {
    const rows = buildMappedRows(headers, [['', '', 'still ignored'], ['Acme', '', '']], mapping)
    expect(rows).toEqual([{ naam: 'Acme', email: '' }])
  })

  it('produces an empty list for no source rows', () => {
    expect(buildMappedRows(headers, [], mapping)).toEqual([])
  })
})
