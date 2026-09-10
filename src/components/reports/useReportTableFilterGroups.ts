/**
 * useReportTableFilterGroups — memoises the buildReportFilterGroups() call plus
 * the two add/remove toggle closures that DepartmentsTable and LocationsTable
 * each redeclared verbatim (DRY round 11, SHIFTMANAGER). `config` carries the
 * per-table label/field keys, so callers keep it a module-level constant
 * (a fresh literal every render would defeat the memo — see its own file).
 */
import { useMemo } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { TFunction } from 'i18next'
import { buildReportFilterGroups } from '@/lib/reportFilters'
import type { FilterGroupConfig } from '@/lib/reportFilters'

export function useReportTableFilterGroups<T extends Record<string, unknown>>({
  t,
  rows,
  customerOptions,
  statusOptions,
  selectedCustomers,
  setSelectedCustomers,
  selectedStatuses,
  setSelectedStatuses,
  config,
}: {
  t: TFunction
  rows: T[]
  customerOptions: Array<{ id: string | number; name?: string }>
  statusOptions: Array<string>
  selectedCustomers: Array<string | number>
  setSelectedCustomers: Dispatch<SetStateAction<Array<string | number>>>
  selectedStatuses: Array<string | number>
  setSelectedStatuses: Dispatch<SetStateAction<Array<string | number>>>
  config: FilterGroupConfig
}) {
  // The two toggle closures (add/remove a value from the selection) moved in
  // from each table's own useMemo — only `config`'s label/field keys still differ.
  return useMemo(() =>
    buildReportFilterGroups({
      t,
      rows,
      customerOptions,
      statusOptions,
      selectedCustomers,
      selectedStatuses,
      onToggleCustomer: (v) => setSelectedCustomers(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]),
      onToggleStatus: (v) => setSelectedStatuses(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]),
      config,
    }),
    [t, rows, customerOptions, statusOptions, selectedCustomers, selectedStatuses, setSelectedCustomers, setSelectedStatuses, config]
  )
}
