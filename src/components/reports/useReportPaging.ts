/**
 * useReportPaging — the shared client-side pagination + sort-toggle state for the
 * SM report tables (CustomersTable/LocationsTable/DepartmentsTable/MessagesTable
 * under components/reports). Sort STATE itself stays with the caller (each table's
 * default column/direction differs), so this hook only owns page/pageSize, the
 * page-1 reset, the current page slice, and the column-toggle handler.
 */
import { useEffect, useMemo, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { usePersistedPageSize } from '@/hooks/usePersistedPageSize'
import type { SortState } from '@/types/reports'

// Owns page/pageSize plus the derived current-page slice for an already sorted array,
// and hands back a setSort_ toggle that flips direction on the same column or resets
// to `defaultDir` when the column changes.
export function useReportPaging<T>(
  sorted: T[],
  setSort: Dispatch<SetStateAction<SortState>>,
  defaultDir: 'asc' | 'desc' = 'asc',
) {
  const [page, setPage] = useState(1)
  const { pageSize, handlePageSizeChange } = usePersistedPageSize()

  // Reset to page 1 whenever the sorted/filtered row count or the page size changes,
  // so pagination never points past the end.
  useEffect(() => setPage(1), [sorted.length, pageSize])
  // Slices the sorted rows to the current page for rendering.
  const paged = useMemo(() => sorted.slice((page - 1) * pageSize, page * pageSize), [sorted, page, pageSize])
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))

  // Toggles direction when re-clicking the active column, otherwise switches to the
  // new column at its default direction.
  const setSort_ = (key: string) => setSort(prev =>
    prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: defaultDir })

  return { page, setPage, pageSize, handlePageSizeChange, paged, totalPages, setSort_ }
}
