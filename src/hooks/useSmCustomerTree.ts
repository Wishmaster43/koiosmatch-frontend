/**
 * useSmCustomerTree — shared data layer for every screen that reads the
 * Shiftmanager customer → location → department → contact tree: the SM report
 * pages (Customers/Locations/Departments) and the reports tables. Fetches ALL
 * pages of /sm_customers (the BE caps one page at 200); each screen derives its
 * own flattened view via useMemo. Cancels on unmount. A failed fetch is reported
 * via `error`, not folded into an empty tree; `truncated` flags a page-cap cut-off.
 */
import { useState, useEffect } from 'react'
import { fetchAllPages } from '@/lib/fetchAllPages'
import { SM_FETCH_ALL } from '@/lib/smFetchAll'
import type { ReportCustomer } from '@/types/reports'

// Stable empty list so a consumer's memo/effect never sees a fresh [] per render.
const EMPTY: ReportCustomer[] = []

// Shared Shiftmanager customer tree fetch; each screen derives its own flattened view from the same full list.
export function useSmCustomerTree() {
  const [customers, setCustomers] = useState<ReportCustomer[]>(EMPTY)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(false)
  const [truncated, setTruncated] = useState(false)

  // Loads every page once on mount; the abort controller drops a late response after unmount.
  useEffect(() => {
    const ctrl = new AbortController()
    fetchAllPages<ReportCustomer>('/sm_customers', {}, ctrl.signal, SM_FETCH_ALL)
      .then(res => {
        if (ctrl.signal.aborted) return
        setCustomers(res.rows)
        setTruncated(res.truncated)
      })
      .catch(() => { if (!ctrl.signal.aborted) setError(true) })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false) })
    return () => ctrl.abort()
  }, [])

  return { customers, loading, error, truncated }
}
