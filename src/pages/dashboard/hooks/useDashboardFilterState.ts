/**
 * useDashboardFilterState — topbar filter selections (period/location/status) and the
 * single-value params sent to the backend. UI-only state; extracted from Dashboard.tsx
 * (§0.3 size split) so `useDashboardData` can consume `dashFilterParams` while the
 * options/registration (right-panel UI) live in `useDashboardFilterPanel`. Behaviour
 * identical to the original inline state.
 */
import { useMemo, useState } from 'react'

export function useDashboardFilterState() {
  const [selPeriode,   setSelPeriode]   = useState<string[]>([])
  const [selVestiging, setSelVestiging] = useState<Array<string | number>>([])
  const [selStatus,    setSelStatus]    = useState<string[]>([])
  // Single-value filters (server-side one value per dimension) sent as query params.
  const dashFilterParams = useMemo(() => {
    const params: Record<string, unknown> = {}
    if (selPeriode[0])   params.period = selPeriode[0]
    if (selStatus[0])    params.status = selStatus[0]
    if (selVestiging[0]) params.location_id = selVestiging[0]
    return params
  }, [selPeriode, selStatus, selVestiging])

  return { selPeriode, setSelPeriode, selVestiging, setSelVestiging, selStatus, setSelStatus, dashFilterParams }
}
