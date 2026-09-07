/**
 * useReportTableFilter — consolidates search/filter/sort memos for report tables.
 * Derives filtered and sorted rows from raw data, search term, and selected filter values.
 * Integrates with RightPanelContext to push filter groups; returns pageable state.
 */
import { useEffect, useMemo } from 'react'
import { useRightPanel } from '@/context/RightPanelContext'

export interface SortState {
  key: string
  dir: 'asc' | 'desc'
}

/**
 * Core filter logic: applies a predicate to each row (to check selected filters),
 * then searches free text across fields. Returns filtered rows.
 */
function applyFilters<T extends Record<string, unknown>>(
  rows: T[],
  search: string,
  filterPredicate: (r: T) => boolean,
  searchFields: (keyof T)[]
): T[] {
  const q = search.trim().toLowerCase()
  return rows.filter(r => {
    if (!filterPredicate(r)) return false
    if (!q) return true
    return searchFields.some(field => {
      const val = r[field]
      const str = val == null ? '' : String(val)
      return str.toLowerCase().includes(q)
    })
  })
}

/**
 * Core sort logic: generic ascending/descending comparator on any field.
 */
export function compareSortable<T extends Record<string, unknown>>(
  a: T,
  b: T,
  key: keyof T,
  dir: 'asc' | 'desc'
): number {
  const av = a[key] == null ? '' : String(a[key]).toLowerCase()
  const bv = b[key] == null ? '' : String(b[key]).toLowerCase()
  if (av < bv) return dir === 'asc' ? -1 : 1
  if (av > bv) return dir === 'asc' ? 1 : -1
  return 0
}

interface UseReportTableFilterOptions<T> {
  rows: T[]
  search: string
  sortState: SortState
  filterPredicate: (r: T) => boolean
  searchFields: (keyof T)[]
  sortKey: keyof T
  filterGroupsConfig: Array<Record<string, unknown>>
  tableId: string
}

/**
 * Consolidates filtered/sorted memo computation and registers filter groups with the panel.
 * Returns { filtered, sorted, filtered.length, sorted.length } for use in the table.
 */
export function useReportTableFilter<T extends Record<string, unknown>>({
  rows,
  search,
  sortState,
  filterPredicate,
  searchFields,
  sortKey,
  filterGroupsConfig,
  tableId,
}: UseReportTableFilterOptions<T>) {
  const { registerFilters, unregisterFilters } = useRightPanel()

  // Filtered rows (search + selected filter values).
  const filtered = useMemo(() =>
    applyFilters(rows, search, filterPredicate, searchFields),
    [rows, search, filterPredicate, searchFields]
  )

  // Sorted rows (filtered + active sort column/direction).
  const sorted = useMemo(() => {
    const { dir } = sortState
    return [...filtered].sort((a, b) =>
      compareSortable(a, b, sortKey, dir)
    )
  }, [filtered, sortState, sortKey])

  // Register filter groups with the panel on mount/change.
  useEffect(() => {
    registerFilters(tableId, filterGroupsConfig)
    return () => unregisterFilters(tableId)
  }, [filterGroupsConfig, tableId, registerFilters, unregisterFilters])

  return { filtered, sorted, filteredCount: filtered.length, sortedCount: sorted.length }
}
