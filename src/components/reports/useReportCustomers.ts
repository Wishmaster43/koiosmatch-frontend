/**
 * useReportCustomers — data layer for the Shiftmanager customers report table.
 * Fetches /sm_customers once and exposes { customers, loading, error }. `error`
 * is a boolean; the view maps it to a translated message so i18n stays in the
 * component (§3, §5). Cancels on unmount.
 */
import { useState, useEffect } from 'react'
import api, { unwrapList } from '@/lib/api'
import type { ReportCustomer } from '@/types/reports'

// Fetches Shiftmanager customers for the reports table.
export function useReportCustomers(): { customers: ReportCustomer[]; loading: boolean; error: boolean } {
  const [customers, setCustomers] = useState<ReportCustomer[]>([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(false)

  // Loads once on mount; the alive flag stops a late response from writing into state after this hook has unmounted.
  useEffect(() => {
    let active = true
    setLoading(true); setError(false)
    api.get('/sm_customers')
      .then(res => {
        if (!active) return
        const { rows } = unwrapList<ReportCustomer>(res)
        setCustomers(rows)
      })
      .catch(() => { if (active) { setError(true); setCustomers([]) } })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  return { customers, loading, error }
}
