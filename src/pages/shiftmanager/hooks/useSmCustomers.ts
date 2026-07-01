/**
 * useSmCustomers — shared data layer for the ShiftManager Customers/Locations/
 * Departments reports. Fetches the customer→location→department tree from
 * /sm_customers once; each report derives its own view (customers / flattened
 * locations / flattened departments) via useMemo. Cancels on unmount.
 */
import { useState, useEffect } from 'react'
import api from '@/lib/api'
import type { ReportCustomer } from '@/types/reports'

export function useSmCustomers() {
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
