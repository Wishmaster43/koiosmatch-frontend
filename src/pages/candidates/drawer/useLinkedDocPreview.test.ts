/**
 * useLinkedDocPreview — shared preview-overlay state + linkedDocumentField
 * builder, adopted by CertificationsTab/EducationTab/SkillsTab (DRY round 11,
 * CANDTABS). `linkedDocumentOptions` itself is covered by
 * documentLinkRules.test.ts — this file asserts only the NEW behaviour: the
 * open/close state machine and the "offer the field only once documents
 * exist" gate.
 */
import { act, renderHook } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { linkedDocumentField, useLinkedDocPreview } from './useLinkedDocPreview'

describe('useLinkedDocPreview', () => {
  it('starts with no preview open, opens on openPreview and clears on closePreview', () => {
    const doc = { id: 'd1', name: 'cv.pdf' }
    const { result } = renderHook(() => useLinkedDocPreview([doc], []))
    expect(result.current.previewDoc).toBeNull()
    act(() => result.current.openPreview(doc))
    expect(result.current.previewDoc).toBe(doc)
    act(() => result.current.closePreview())
    expect(result.current.previewDoc).toBeNull()
  })

  it('resolves documentOptions from the candidate\'s own documents (DOC-1-EIGENAAR-1)', () => {
    const doc = { id: 'd1', name: 'cv.pdf' }
    const { result } = renderHook(() => useLinkedDocPreview([doc], []))
    expect(result.current.documentOptions({})).toEqual([{ value: 'd1', label: 'cv.pdf' }])
  })
})

describe('linkedDocumentField', () => {
  const documentOptions = () => [{ value: 'd1', label: 'cv.pdf' }]

  it('offers no field at all when the candidate has no documents (§3, no fake affordance)', () => {
    expect(linkedDocumentField('Gekoppeld document', [], documentOptions)).toEqual([])
  })

  it('offers exactly one document_id field, with the caller\'s own label, once documents exist', () => {
    const docs = [{ id: 'd1', name: 'cv.pdf' }]
    expect(linkedDocumentField('Gekoppeld document', docs, documentOptions)).toEqual([
      { key: 'document_id', label: 'Gekoppeld document', options: documentOptions },
    ])
  })
})
