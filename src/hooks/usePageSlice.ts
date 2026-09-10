/**
 * usePageSlice — client-side pagination over an already-filtered array: total
 * row count, last page and the current page's rows. Same totalRows/lastPage/
 * filtered arithmetic shared by every list page that paginates an in-memory
 * array instead of a server-paginated fetch (opportunities/tasks/matches).
 */
import { useMemo } from 'react'

// Slices `filteredAll` to the current page (see file header for the shared arithmetic).
export function usePageSlice<T>(filteredAll: T[], page: number, pageSize: number) {
  const totalRows = filteredAll.length
  const lastPage = Math.max(1, Math.ceil(totalRows / pageSize))
  const filtered = useMemo(() => filteredAll.slice((page - 1) * pageSize, page * pageSize), [filteredAll, page, pageSize])
  return { totalRows, lastPage, filtered }
}
