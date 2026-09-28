/**
 * useDashboardFilterState — topbar filter selections (period/branch/status) and the
 * params sent to the backend. UI-only state; extracted from Dashboard.tsx (§0.3 size
 * split) so `useDashboardData` can consume `dashFilterParams` while the options/
 * registration (right-panel UI) live in `useDashboardFilterPanel`.
 *
 * K-173 fase 3 — the branch filter went MULTI and switched to `branch_id[]` (the
 * VESTIGING-2 convention shared with customers/candidates, incl. the NO_BRANCH_VALUE
 * 'none' sentinel for unassigned rows) — legacy single-value `location_id` is gone
 * from the call entirely, never sent alongside the new param.
 */
import { useMemo, useState } from 'react'

// Owns the topbar filter selections and derives the server params from them; period/status stay single-value while branch is a real multi-select (see file header).
export function useDashboardFilterState() {
  const [selPeriod,   setSelPeriod]   = useState<string[]>([])
  const [selBranch, setSelBranch] = useState<Array<string | number>>([])
  const [selStatus,    setSelStatus]    = useState<string[]>([])
  // Period/status stay single-value server-side; branch is now a real multi-select.
  const dashFilterParams = useMemo(() => {
    const params: Record<string, unknown> = {}
    if (selPeriod[0])      params.period = selPeriod[0]
    if (selStatus[0])       params.status = selStatus[0]
    if (selBranch.length) params.branch_id = selBranch
    return params
  }, [selPeriod, selStatus, selBranch])

  return { selPeriod, setSelPeriod, selBranch, setSelBranch, selStatus, setSelStatus, dashFilterParams }
}
