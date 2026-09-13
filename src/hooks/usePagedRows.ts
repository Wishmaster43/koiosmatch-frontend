/**
 * usePagedRows — the shared client-side pagination slice for the Shiftmanager
 * mirror list pages (Contacts/Departments/Locations): derives totalPages and
 * the current page's rows from the filtered set. `page` state is always owned
 * here; `pageSize` is owned here too UNLESS the caller passes its own
 * `pageSize`/`setPageSize` (DepartmentsPage sources its size from the shared
 * `useListPageSize` tenant default instead of a bare local state). Hand-copied
 * identically across those pages before this consolidation.
 */
import { useState } from 'react'

interface UsePagedRowsOptions {
  initialPageSize?: number
  pageSize?: number
  setPageSize?: (size: number) => void
}

export function usePagedRows<T>(filtered: T[], options: UsePagedRowsOptions = {}) {
  const [page, setPage] = useState(1)
  const [localPageSize, setLocalPageSize] = useState(options.initialPageSize ?? 50)
  // External pageSize (e.g. useListPageSize) wins when the caller supplies one.
  const pageSize = options.pageSize ?? localPageSize
  const setPageSize = options.setPageSize ?? setLocalPageSize
  const totalPages = Math.ceil(filtered.length / pageSize)
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize)
  return { page, setPage, pageSize, setPageSize, totalPages, paged }
}
