import { useMemo } from 'react'

/** Minimal type for documents that can be filtered. */
type DocItem = {
  name?: string
  file_name?: string
  type?: string
}

interface UseDocumentFilteringParams<T extends DocItem> {
  docs: T[]
  docSearch: string
  docTypeFilter: string
  docUrl: (d: T) => string | undefined
  docKey: (d: T, index: number) => string
}

interface UseDocumentFilteringResult<T extends DocItem> {
  filteredDocs: Array<T & { _i: number }>
  filteredDownloadableKeys: string[]
  allFilteredSelected: (selected: Set<string>) => boolean
}

/** Shared document filtering logic: search by name/type, filter by type,
 * compute downloadable keys and all-selected state. Used by candidates,
 * customers, and vacancies documents tabs.
 */
export function useDocumentFiltering<T extends DocItem>({
  docs,
  docSearch,
  docTypeFilter,
  docUrl,
  docKey,
}: UseDocumentFilteringParams<T>): UseDocumentFilteringResult<T> {
  const filteredDocs = useMemo(
    () =>
      docs
        .map((d, i) => ({ ...d, _i: i }))
        .filter(
          (d) =>
            !docSearch ||
            (d.name ?? d.file_name ?? '')
              .toLowerCase()
              .includes(docSearch.toLowerCase()) ||
            (d.type ?? '').toLowerCase().includes(docSearch.toLowerCase())
        )
        .filter((d) => !docTypeFilter || (d.type ?? '') === docTypeFilter),
    [docs, docSearch, docTypeFilter]
  )

  // Keys of only the filtered docs that actually have a download URL, for bulk-select-all.
  const filteredDownloadableKeys = useMemo(
    () => filteredDocs.filter((d) => docUrl(d)).map((d) => docKey(d, d._i)),
    [filteredDocs, docUrl, docKey]
  )

  return {
    filteredDocs,
    filteredDownloadableKeys,
    allFilteredSelected: (selected: Set<string>) =>
      filteredDownloadableKeys.length > 0 &&
      filteredDownloadableKeys.every((k) => selected.has(k)),
  }
}
