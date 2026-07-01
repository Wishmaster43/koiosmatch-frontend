/**
 * useDrillDownShifts — data layer for ShiftsDrillDownDrawer (§3): loads the shifts
 * behind a chart/KPI data point from the given URL and exposes the loading/error
 * states. Aborts a stale request when the URL changes or on unmount. The error is a
 * boolean flag so the drawer owns the (i18n) message.
 */
import { useState, useEffect } from 'react'
import api from '@/lib/api'
import type { ShiftRow } from '@/types/shiftmanager'

export function useDrillDownShifts(fetchUrl: string) {
  const [shifts,  setShifts]  = useState<ShiftRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(false)

  useEffect(() => {
    if (!fetchUrl) return
    let active = true
    setLoading(true)
    setError(false)
    api.get(fetchUrl)
      .then(res => {
        if (!active) return
        const data = res.data?.data ?? res.data ?? []
        setShifts(Array.isArray(data) ? data : [])
      })
      .catch(() => { if (active) setError(true) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [fetchUrl])

  return { shifts, loading, error }
}
