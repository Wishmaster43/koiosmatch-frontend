/**
 * api.test.ts — the payload builder is what the wizard actually uploads, so this
 * asserts the REQUEST SHAPE (the exact CSV bytes inside the File), never only that
 * a callback fired (CLAUDE.md §13).
 */
import { describe, it, expect } from 'vitest'
import { buildImportFile } from './api'
import { parseCsvText } from './lib/csv'

describe('buildImportFile', () => {
  it('builds a File named after the entity, headers in the ENTITY column order', async () => {
    const file = buildImportFile('customers', ['naam', 'email', 'plaats'], [{ email: 'a@b.nl', naam: 'Acme' }])
    expect(file.name).toBe('customers.csv')
    expect(file.type).toBe('text/csv')
    const text = await file.text()
    // Header order follows targetColumns, NOT the row object's own key insertion order.
    expect(text).toContain('naam;email;plaats')
    expect(text).toContain('Acme;a@b.nl;')
  })

  it('fills a column absent from a row with a blank cell, never inventing a value', async () => {
    const file = buildImportFile('customers', ['naam', 'website'], [{ naam: 'Acme' }])
    const parsed = parseCsvText(await file.text())
    expect(parsed.rows).toEqual([['Acme', '']])
  })

  it('round-trips through the real CSV parser with the exact edited values', async () => {
    const rows = [{ naam: 'De Vries; Zorg', email: 'contact@devries.nl' }]
    const file = buildImportFile('customers', ['naam', 'email'], rows)
    const parsed = parseCsvText(await file.text())
    expect(parsed.headers).toEqual(['naam', 'email'])
    expect(parsed.rows).toEqual([['De Vries; Zorg', 'contact@devries.nl']])
  })
})
