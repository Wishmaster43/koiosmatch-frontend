import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useDocumentFiltering } from './useDocumentFiltering'

interface TestDocItem {
  id?: string
  name?: string
  file_name?: string
  type?: string
  url?: string
  _i?: number
}

describe('useDocumentFiltering', () => {
  const mockDocs = [
    { id: '1', name: 'Resume.pdf', type: 'CV', url: 'http://example.com/resume.pdf' },
    { id: '2', file_name: 'Certificate.pdf', type: 'Certificate', url: 'http://example.com/cert.pdf' },
    { id: '3', name: 'Diploma', type: 'Education', url: 'http://example.com/diploma.pdf' },
    { id: '4', name: 'Old File', type: 'CV', url: undefined },
  ]

  const mockDocUrl = (d: TestDocItem) => d.url
  const mockDocKey = (d: TestDocItem, i: number) => String(d.id ?? 'idx-' + i)

  it('returns all docs when no filter applied', () => {
    const { result } = renderHook(() =>
      useDocumentFiltering({
        docs: mockDocs,
        docSearch: '',
        docTypeFilter: '',
        docUrl: mockDocUrl,
        docKey: mockDocKey,
      })
    )

    expect(result.current.filteredDocs).toHaveLength(4)
    expect(result.current.filteredDownloadableKeys).toHaveLength(3) // Only docs with url
  })

  it('filters by document type', () => {
    const { result } = renderHook(() =>
      useDocumentFiltering({
        docs: mockDocs,
        docSearch: '',
        docTypeFilter: 'CV',
        docUrl: mockDocUrl,
        docKey: mockDocKey,
      })
    )

    expect(result.current.filteredDocs).toHaveLength(2)
    expect(result.current.filteredDocs[0].type).toBe('CV')
    expect(result.current.filteredDocs[1].type).toBe('CV')
  })

  it('filters by search term', () => {
    const { result } = renderHook(() =>
      useDocumentFiltering({
        docs: mockDocs,
        docSearch: 'resume',
        docTypeFilter: '',
        docUrl: mockDocUrl,
        docKey: mockDocKey,
      })
    )

    expect(result.current.filteredDocs).toHaveLength(1)
    expect(result.current.filteredDocs[0].name).toBe('Resume.pdf')
  })

  it('computes allFilteredSelected correctly', () => {
    const { result } = renderHook(() =>
      useDocumentFiltering({
        docs: mockDocs,
        docSearch: '',
        docTypeFilter: 'CV',
        docUrl: mockDocUrl,
        docKey: mockDocKey,
      })
    )

    // Filter by CV: doc 1 (url) and doc 4 (no url)
    // filteredDownloadableKeys should be ['1']
    const notAllSelected = new Set<string>() // Nothing selected
    expect(result.current.allFilteredSelected(notAllSelected)).toBe(false)

    const allSelected = new Set(['1']) // The one downloadable CV is selected
    expect(result.current.allFilteredSelected(allSelected)).toBe(true)
  })
})
