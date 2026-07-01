/**
 * useSmCustomerTree — shared data layer for every screen that reads the
 * ShiftManager customer → location → department → contact tree: the SM report
 * pages (Customers/Locations/Departments) and the reports tables. Fetches
 * /sm_customers once; each screen derives its own flattened view via useMemo.
 * Cancels on unmount. A missing endpoint is an empty tree, not an error — the
 * consumer renders the four UI states (§3).
 */
import { useState, useEffect } from 'react'
import api from '@/lib/api'
import type { ReportCustomer } from '@/types/reports'

export function useSmCustomerTree() {
  const [customers, setCustomers] = useState<ReportCustomer[]>([])
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    let active = true
    api.get('/sm_customers')
      .then(res => {
        if (!active) return
        const data = res.data
        setCustomers(Array.isArray(data) ? data : (data?.data ?? []))
      })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  return { customers, loading }
}
