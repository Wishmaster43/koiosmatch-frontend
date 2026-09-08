/**
 * useNumericColumnSort — applies numeric comparison to a sorted array when
 * the active sort key matches the target column. Handles integer/float values
 * extracted from rows via getValue(). Delegates to identity when sort is inactive.
 */
import { useMemo } from 'react'
import type { SortState } from '@/types/reports'

export default function useNumericColumnSort<T>(
  rows: T[],
  sort: SortState,
  columnKey: string,
  getValue: (row: T) => number | undefined
): T[] {
  return useMemo(() => {
    if (sort.key !== columnKey) return rows
    const { dir } = sort
    return [...rows].sort((a, b) => {
      const av = getValue(a) ?? 0
      const bv = getValue(b) ?? 0
      if (av < bv) return dir === 'asc' ? -1 : 1
      if (av > bv) return dir === 'asc' ? 1 : -1
      return 0
    })
  }, [rows, sort, columnKey, getValue])
}
