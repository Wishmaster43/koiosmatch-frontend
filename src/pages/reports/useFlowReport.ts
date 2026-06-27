/**
 * useFlowReport — data layer for FlowReport: loads GET /reports/flow for the
 * given period and exposes the four UI states. Cancels a stale request when the
 * period changes or the component unmounts.
 */
import { useEffect, useState } from 'react'
import api from '../../lib/api'
import type { FlowReportData, ReportPeriod } from '@/types/analytics'

export function useFlowReport(period: ReportPeriod) {
  const [data,    setData]    = useState<FlowReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(false)
    api.get('/reports/flow', { params: { period } })
      .then(res => { if (active) setData(res.data ?? null) })
      .catch(() => { if (active) setError(true) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [period])

  return { data, loading, error }
}
