/**
 * documentLinkRules — DOC-1-EIGENAAR-1 (Danny 08-08 punt 6). Proves the filter that
 * keeps an already-claimed document out of every "koppelen" list, and the carve-out
 * that keeps the row's OWN pick visible so it can still be seen, switched or cleared.
 * Mirrors the live-measured backend guard (see the module header).
 */
import { describe, it, expect } from 'vitest'
import { isDocumentClaimed, selectableDocuments, selectableEntries, hasSelectableEntry } from './documentLinkRules'

const free = { id: 'd-free', education_id: null, certification_id: null, language_id: null, skill_id: null, reference_id: null }
const onEducation = { id: 'd-edu', education_id: 'e1' }
const onCertification = { id: 'd-cert', certification_id: 'c1' }
const onLanguage = { id: 'd-lang', language_id: 'l1' }
const onSkill = { id: 'd-skill', skill_id: 's1' }
const onReference = { id: 'd-ref', reference_id: 'r1' }

describe('isDocumentClaimed · every one of the five owner tables counts', () => {
  it('is false for a document with no reverse link at all', () => {
    expect(isDocumentClaimed(free)).toBe(false)
    expect(isDocumentClaimed({ id: 'd1' })).toBe(false)
  })

  it('is true for each of education / certification / language / skill / reference', () => {
    ;[onEducation, onCertification, onLanguage, onSkill, onReference].forEach(doc => {
      expect(isDocumentClaimed(doc)).toBe(true)
    })
  })
})

describe('selectableDocuments · a claimed document is never offered', () => {
  it('drops every claimed document and keeps the free ones', () => {
    const result = selectableDocuments([free, onEducation, onCertification, onLanguage, onSkill, onReference])
    expect(result.map(d => d.id)).toEqual(['d-free'])
  })

  it('KEEPS the document this very entry already holds, so the pick stays visible', () => {
    const result = selectableDocuments([free, onCertification], { currentDocumentId: 'd-cert' })
    expect(result.map(d => d.id)).toEqual(['d-free', 'd-cert'])
  })

  it('matches the current pick across a number/string id mix (temp rows carry numbers)', () => {
    const numeric = [{ id: 1, education_id: 'e9' }, { id: 2 }]
    expect(selectableDocuments(numeric, { currentDocumentId: '1' }).map(d => d.id)).toEqual([1, 2])
  })

  it('also drops a document a SIBLING entry claimed this session (before any refetch)', () => {
    // Neither document carries a reverse FK yet — the sibling entry is the only
    // fresh evidence that "vca.pdf" is taken.
    const documents = [{ id: 'd1' }, { id: 'd2' }]
    const siblings = [{ id: 'c1', document_id: 'd1' }, { id: 'c2', document_id: null }]
    const result = selectableDocuments(documents, { siblings, currentEntryId: 'c2', currentDocumentId: null })
    expect(result.map(d => d.id)).toEqual(['d2'])
  })

  it('never lets an entry hide its OWN document from itself via the sibling check', () => {
    const documents = [{ id: 'd1' }, { id: 'd2' }]
    const siblings = [{ id: 'c1', document_id: 'd1' }]
    const result = selectableDocuments(documents, { siblings, currentEntryId: 'c1', currentDocumentId: 'd1' })
    expect(result.map(d => d.id)).toEqual(['d1', 'd2'])
  })
})

describe('selectableEntries · an occupied entry is never offered as a link target', () => {
  const entries = [
    { id: 'e1', document_id: 'd-edu' },
    { id: 'e2', document_id: null },
    { id: 'e3' },
  ]

  it('drops entries that already carry a document', () => {
    expect(selectableEntries(entries).map(e => e.id)).toEqual(['e2', 'e3'])
  })

  it('KEEPS the entry this document currently hangs on, so it can be switched or cleared', () => {
    expect(selectableEntries(entries, 'e1').map(e => e.id)).toEqual(['e1', 'e2', 'e3'])
  })
})

describe('hasSelectableEntry · gates the "change link" affordance honestly', () => {
  it('is false when every entry in every list is already occupied', () => {
    expect(hasSelectableEntry([[{ id: 'e1', document_id: 'd1' }], [{ id: 'c1', document_id: 'd2' }]])).toBe(false)
  })

  it('is true when the document may at least be unlinked from its own entry', () => {
    expect(hasSelectableEntry([[{ id: 'e1', document_id: 'd1' }]], 'e1')).toBe(true)
  })

  it('is true as soon as one list has a free slot', () => {
    expect(hasSelectableEntry([[{ id: 'e1', document_id: 'd1' }], [{ id: 'c1' }]])).toBe(true)
  })

  it('is false for empty lists (nothing to link to at all)', () => {
    expect(hasSelectableEntry([[], []])).toBe(false)
  })
})
