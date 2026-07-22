/**
 * useDashboardFilterPanel — builds the right-panel filter groups (period options are
 * static slugs translated here; location/status options come live from GET /dashboard
 * `filters`) and registers/unregisters them with the shared right panel. Extracted
 * from Dashboard.tsx (§0.3 size split); behaviour identical to the original inline
 * effect.
 */
import { useEffect, useMemo } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { useRightPanel } from '@/context/RightPanelContext'
import type { DashData } from '@/types/dashboard'

// Period filter slugs — stable values sent to the backend as `period`. Labels are
// translated inside the hook (a module-scope const can't call t()); Vestiging +
// status options come live from GET /dashboard (filters.locations / filters.statuses).
const PERIOD_VALUES = ['vandaag', 'week', 'maand', 'kwartaal', 'jaar'] as const

interface UseDashboardFilterPanelArgs {
  dash: DashData | null
  t: (key: string) => string
  selPeriode: string[]; setSelPeriode: Dispatch<SetStateAction<string[]>>
  selVestiging: Array<string | number>; setSelVestiging: Dispatch<SetStateAction<Array<string | number>>>
  selStatus: string[]; setSelStatus: Dispatch<SetStateAction<string[]>>
}

export function useDashboardFilterPanel({
  dash, t, selPeriode, setSelPeriode, selVestiging, setSelVestiging, selStatus, setSelStatus,
}: UseDashboardFilterPanelArgs) {
  // Translate the stable period slugs into labels here (hook scope has t()).
  const periodOptions = useMemo(() =>
    PERIOD_VALUES.map(value => ({ value, label: t(`filters.period.${value}`) })), [t])

  const filterGroups = useMemo(() => [
    { key: 'periode', label: t('filters.periodLabel'), selected: selPeriode,
      options: periodOptions,
      onToggle: (v: string) => setSelPeriode(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]) },
    { key: 'vestiging', label: t('filters.locationLabel'), selected: selVestiging,
      options: (dash?.filters?.locations ?? []).map(l => ({ value: l.id, label: l.name })),
      onToggle: (v: string | number) => setSelVestiging(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]) },
    { key: 'kandidaatstatus', label: t('filters.statusLabel'), selected: selStatus,
      options: (dash?.filters?.statuses ?? []).map(s => ({ value: s.value, label: s.label })),
      onToggle: (v: string) => setSelStatus(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]) },
    // Setters are stable (useState identity) but are now received as params rather than
    // declared locally, so React's exhaustive-deps can no longer infer that — list them
    // explicitly; harmless since their identity never changes across renders.
  ], [selPeriode, selVestiging, selStatus, dash, periodOptions, t, setSelPeriode, setSelVestiging, setSelStatus])

  // Register this page's filter groups with the shared right panel; clean up on unmount.
  const { registerFilters, unregisterFilters } = useRightPanel()
  useEffect(() => {
    registerFilters('dashboard', filterGroups)
    return () => unregisterFilters('dashboard')
  }, [filterGroups, registerFilters, unregisterFilters])
}
