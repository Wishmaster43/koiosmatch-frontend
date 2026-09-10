import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useState } from 'react'
import { useDocumentSelection } from './useDocumentSelection'
import * as downloadFiles from '@/lib/downloadFiles'

interface TestDoc {
  id: string
  name?: string
  file_name?: string
  type?: string
  url?: string
}

const mockDocs: TestDoc[] = [
  { id: '1', name: 'Resume.pdf', type: 'CV', url: 'http://example.com/resume.pdf' },
  { id: '2', file_name: 'Certificate.pdf', type: 'Certificate', url: 'http://example.com/cert.pdf' },
  { id: '3', name: 'Old File', type: 'CV', url: undefined },
]

const docUrl = (d: TestDoc) => d.url
const docKey = (d: TestDoc, i: number) => String(d.id ?? 'idx-' + i)

// Renders the hook with its own local `selected` state, mirroring the three
// document-tab consumers.
function setup(nameOf: (d: TestDoc) => string | undefined = d => d.name ?? d.file_name) {
  return renderHook(() => {
    const [selected, setSelected] = useState<Set<string>>(new Set())
    return useDocumentSelection({
      docs: mockDocs, docSearch: '', docTypeFilter: '', docUrl, docKey, nameOf, selected, setSelected,
    })
  })
}

describe('useDocumentSelection', () => {
  afterEach(() => vi.restoreAllMocks())

  // Select-all turns on every downloadable, filtered row and toggling it again clears them.
  it('toggleSelectAll selects then clears every filtered downloadable row', () => {
    const { result } = setup()
    expect(result.current.allFilteredSelected).toBe(false)
    act(() => result.current.toggleSelectAll())
    expect(result.current.allFilteredSelected).toBe(true)
    act(() => result.current.toggleSelectAll())
    expect(result.current.allFilteredSelected).toBe(false)
  })

  // A single row toggle flips only that row, leaving allFilteredSelected false.
  it('toggleSelectedRow flips one row independently of select-all', () => {
    const { result } = setup()
    act(() => result.current.toggleSelectedRow('1'))
    expect(result.current.allFilteredSelected).toBe(false)
    act(() => result.current.toggleSelectedRow('2'))
    expect(result.current.allFilteredSelected).toBe(true)
  })

  // downloadSelected calls the shared downloader with the resolved url/name pairs
  // for every selected row, in list order, then clears the selection.
  it('downloads every selected row via the caller-supplied nameOf and clears selection', async () => {
    const spy = vi.spyOn(downloadFiles, 'downloadFilesSequentially').mockResolvedValue(2)
    const { result } = setup()
    act(() => result.current.toggleSelectAll())
    await act(async () => { await result.current.downloadSelected() })
    expect(spy).toHaveBeenCalledWith([
      { url: 'http://example.com/resume.pdf', name: 'Resume.pdf' },
      { url: 'http://example.com/cert.pdf', name: 'Certificate.pdf' },
    ])
    expect(result.current.allFilteredSelected).toBe(false)
  })

  // Rule B: nameOf is the caller's own resolver — a vacancies-style nameOf with
  // no file_name fallback sends `undefined` for a doc that only has file_name.
  it('carries the caller nameOf difference instead of unifying on one form', async () => {
    const spy = vi.spyOn(downloadFiles, 'downloadFilesSequentially').mockResolvedValue(1)
    const { result } = setup(d => d.name)
    act(() => result.current.toggleSelectedRow('2'))
    await act(async () => { await result.current.downloadSelected() })
    expect(spy).toHaveBeenCalledWith([{ url: 'http://example.com/cert.pdf', name: undefined }])
  })
})
