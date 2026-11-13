/**
 * useDashboardFilterPanel — builds the right-panel filter groups (period options are
 * the English PERIOD_KEYS translated here; status options come live from GET /dashboard
 * `filters`, branch options from useBranchOptions) and registers/unregisters them with
 * the shared right panel. Extracted from Dashboard.tsx (§0.3 size split); behaviour
 * identical to the original inline effect.
 */
import { useEffect, useMemo } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { useRightPanel } from '@/context/RightPanelContext'
import { useBranchOptions } from '@/lib/useBranchOptions'
import type { DashData } from '@/types/dashboard'
import { PERIOD_KEYS } from '../lib/periodWire'

interface UseDashboardFilterPanelArgs {
  dash: DashData | null
  t: (key: string) => string
  selPeriod: string[]; setSelPeriod: Dispatch<SetStateAction<string[]>>
  selBranch: Array<string | number>; setSelBranch: Dispatch<SetStateAction<Array<string | number>>>
  selStatus: string[]; setSelStatus: Dispatch<SetStateAction<string[]>>
}

// Assembles and registers the dashboard's right-panel filter groups; see the module
// doc comment above for where each dimension's options come from.
export function useDashboardFilterPanel({
  dash, t, selPeriod, setSelPeriod, selBranch, setSelBranch, selStatus, setSelStatus,
}: UseDashboardFilterPanelArgs) {
  // The period ids are the English PERIOD_KEYS (periodWire.toWirePeriod in useDashboardFilterState
  // turns them into the Dutch wire value until the BE hash); labels are translated here (hook scope has t()).
  const periodOptions = useMemo(() =>
    PERIOD_KEYS.map(value => ({ value, label: t(`filters.period.${value}`) })), [t])
  // K-173 fase 3 — branch options come from the shared useBranchOptions hook (the
  // user's own scope, incl. the 'none' unassigned sentinel), never dash.filters.locations.
  const branchOptions = useBranchOptions()

  // Three filter groups (period/branch/status) in the shape the shared right panel expects.
  const filterGroups = useMemo(() => [
    { key: 'period', label: t('filters.periodLabel'), selected: selPeriod,
      options: periodOptions,
      onToggle: (v: string) => setSelPeriod(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]) },
    { key: 'branch', label: t('filters.locationLabel'), selected: selBranch,
      options: branchOptions,
      onToggle: (v: string | number) => setSelBranch(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]) },
    { key: 'status', label: t('filters.statusLabel'), selected: selStatus,
      options: (dash?.filters?.statuses ?? []).map(s => ({ value: s.value, label: s.label })),
      onToggle: (v: string) => setSelStatus(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]) },
    // Setters are stable (useState identity) but are now received as params rather than
    // declared locally, so React's exhaustive-deps can no longer infer that — list them
    // explicitly; harmless since their identity never changes across renders.
  ], [selPeriod, selBranch, selStatus, dash, periodOptions, branchOptions, t, setSelPeriod, setSelBranch, setSelStatus])

  const { registerFilters, unregisterFilters } = useRightPanel()
  // Register this page's filter groups with the shared right panel; unregister on
  // unmount so they don't leak to other pages.
  useEffect(() => {
    registerFilters('dashboard', filterGroups)
    return () => unregisterFilters('dashboard')
  }, [filterGroups, registerFilters, unregisterFilters])
}
