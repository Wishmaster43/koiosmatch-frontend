import { describe, it, expect, vi } from 'vitest'
import type { TFunction } from 'i18next'
import { docTypeFilterRow } from './documentFilterRow'

// A stub t() that mirrors the real translation for the two keys the row uses.
const t = ((key: string) => (key === 'documents.type' ? 'Type' : 'All')) as unknown as TFunction

describe('docTypeFilterRow', () => {
  // Empty tenant lookup hides the filter row entirely (DrawerFilterMenu contract).
  it('returns an empty array when there are no document types', () => {
    expect(docTypeFilterRow(t, [], '', vi.fn(), (v: string) => v)).toEqual([])
  })

  // A configured lookup renders one single-select row carrying the caller's
  // own onChange and translated labels, mapped through docTypeLabel.
  it('builds one single-select row from the tenant document types', () => {
    const onChange = vi.fn()
    const rows = docTypeFilterRow(t, [{ value: 'CV', label: 'CV' }], 'CV', onChange, (v: string) => `label:${v}`)
    expect(rows).toEqual([{
      type: 'single', key: 'docType', label: 'Type', value: 'CV', onChange,
      allLabel: 'All',
      options: [{ value: 'CV', label: 'label:CV' }],
    }])
  })
})
