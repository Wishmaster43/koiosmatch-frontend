/**
 * useReportDrill — data layer for ReportDrillDrawer (§3): when a drill opens, loads
 * the underlying records (rowsEndpoint) + Koios AI advice (adviceEndpoint). Both
 * degrade gracefully (a missing endpoint just leaves an empty list / no advice) and
 * abort when the drill changes or on unmount.
 */
import { useState, useEffect } from 'react'
import api from '@/lib/api'
import type { DrillSpec } from './ReportDrillDrawer'

type DrillRow = Record<string, unknown>

export function useReportDrill(drill: DrillSpec | null) {
  const [rows,          setRows]          = useState<DrillRow[]>([])
  const [rowsLoading,   setRowsLoading]   = useState(false)
  const [advice,        setAdvice]        = useState<string | null>(null)
  const [adviceLoading, setAdviceLoading] = useState(false)

  useEffect(() => {
    if (!drill) return
    const ctrl = new AbortController()

    setRows([]); setAdvice(null)
    if (drill.rowsEndpoint) {
      setRowsLoading(true)
      api.get(drill.rowsEndpoint, { params: drill.rowsParams, signal: ctrl.signal })
        .then(r => setRows(r.data?.data ?? r.data ?? []))
        .catch(() => {})
        .finally(() => setRowsLoading(false))
    }
    if (drill.adviceEndpoint) {
      setAdviceLoading(true)
      api.get(drill.adviceEndpoint, { params: drill.adviceParams, signal: ctrl.signal })
        .then(r => setAdvice(r.data?.advice ?? r.data?.data?.advice ?? (typeof r.data === 'string' ? r.data : null)))
        .catch(() => {})
        .finally(() => setAdviceLoading(false))
    }
    return () => ctrl.abort()
  }, [drill])

  return { rows, rowsLoading, advice, adviceLoading }
}
