/**
 * useIntakesReport — data layer for IntakesReport: loads GET /reports/intakes for
 * the given period (mapped to the endpoint's `bucket`). Exposes the four UI states
 * and cancels a stale request on period change / unmount.
 */
import { useEffect, useState } from 'react'
import api from '@/lib/api'
import type { IntakesReportData, ReportPeriod } from '@/types/analytics'

export function useIntakesReport(period: ReportPeriod) {
  const [data,    setData]    = useState<IntakesReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(false)

  // The intakes endpoint groups by `bucket` (day/week/month) = the shared period control.
  useEffect(() => {
    let active = true
    setLoading(true)
    setError(false)
    api.get('/reports/intakes', { params: { bucket: period } })
      .then(res => { if (active) setData(res.data ?? null) })
      .catch(() => { if (active) setError(true) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [period])

  return { data, loading, error }
}
