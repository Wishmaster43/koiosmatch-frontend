/**
 * useCustomerOptions — deduped, alphabetised customer id/name pairs for report filters.
 * Extracts and memoises customer lookups from rows to populate search-select dropdowns.
 * Rows must carry customer_id and customer_name properties.
 */
import { useMemo } from 'react'

export function useCustomerOptions<T extends Record<string, unknown>>(
  rows: T[]
) {
  return useMemo(() =>
    [...new Map(rows.map(r => [r.customer_id, r.customer_name] as [string | number, string | undefined])).entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '')),
    [rows])
}
