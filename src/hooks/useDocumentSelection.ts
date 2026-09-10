import type { Dispatch, SetStateAction } from 'react'
import { useDocumentFiltering } from './useDocumentFiltering'
import { downloadFilesSequentially } from '@/lib/downloadFiles'

/** Minimal type for documents that can be filtered and selected. */
type DocItem = {
  name?: string
  file_name?: string
  type?: string
}

interface UseDocumentSelectionParams<T extends DocItem> {
  docs: T[]
  docSearch: string
  docTypeFilter: string
  docUrl: (d: T) => string | undefined
  docKey: (d: T, index: number) => string
  // Rule B (DRY round 11, DOCTABS): candidates/customers fall back to
  // file_name for a download's file name, vacancies never had that fallback —
  // the caller supplies its own resolver rather than the hook unifying on one form.
  nameOf: (d: T) => string | undefined
  selected: Set<string>
  setSelected: Dispatch<SetStateAction<Set<string>>>
}

interface UseDocumentSelectionResult<T extends DocItem> {
  filteredDocs: Array<T & { _i: number }>
  filteredDownloadableKeys: string[]
  allFilteredSelected: boolean
  toggleSelectAll: () => void
  toggleSelectedRow: (key: string) => void
  downloadSelected: () => Promise<void>
}

/** Shared search-filtered bulk-selection behaviour for the candidates, customers
 * and vacancies documents tabs: filtering (via useDocumentFiltering), select-all
 * over the currently filtered+downloadable rows, a single-row toggle, and the
 * sequential download of everything selected.
 */
export function useDocumentSelection<T extends DocItem>({
  docs, docSearch, docTypeFilter, docUrl, docKey, nameOf, selected, setSelected,
}: UseDocumentSelectionParams<T>): UseDocumentSelectionResult<T> {
  const { filteredDocs, filteredDownloadableKeys, allFilteredSelected: isAllFiltered } = useDocumentFiltering({
    docs, docSearch, docTypeFilter, docUrl, docKey,
  })
  const allFilteredSelected = isAllFiltered(selected)

  // Select-all toggles every currently-filtered downloadable row at once.
  const toggleSelectAll = () => {
    setSelected(prev => {
      const next = new Set(prev)
      if (allFilteredSelected) filteredDownloadableKeys.forEach(k => next.delete(k))
      else filteredDownloadableKeys.forEach(k => next.add(k))
      return next
    })
  }
  // Flips one row's selection for the bulk-download picker.
  const toggleSelectedRow = (key: string) => {
    setSelected(prev => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next })
  }
  // Start the sequential download for every selected doc, in list order, then clear.
  const downloadSelected = async () => {
    const items = docs.map((d, i) => ({ d, key: docKey(d, i) })).filter(({ key }) => selected.has(key)).map(({ d }) => ({ url: docUrl(d), name: nameOf(d) }))
    await downloadFilesSequentially(items)
    setSelected(new Set())
  }

  return { filteredDocs, filteredDownloadableKeys, allFilteredSelected, toggleSelectAll, toggleSelectedRow, downloadSelected }
}
