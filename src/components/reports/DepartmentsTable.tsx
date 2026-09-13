/**
 * DepartmentsTable — searchable, sortable, paginated table of departments.
 * Clicking a row opens DepartmentDrawer. Filters come from RightPanelContext,
 * page size from the user's preference; data is fetched per page from the API.
 * Chrome (sortable header + toolbar) and paging state come from the shared
 * reportTableChrome/useReportPaging (§3, "36-42 identical lines" consolidation).
 */
import { useState, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import DepartmentDrawer       from './DepartmentDrawer'
import { useReportPaging }    from './useReportPaging'
import { TD, ReportTableToolbar, ReportRow } from './reportTableChrome'
import { ReportPagedTableShell } from './ReportPagedTableShell'
import { distinctSortedValues } from './distinctSortedValues'
import { useReportTableFilter } from './useReportTableFilter'
import { useReportTableFilterGroups } from './useReportTableFilterGroups'
import { renderMonospaceCell } from './reportTableCells'
import { useSmCustomerTree }  from '@/hooks/useSmCustomerTree'
import { useCustomerOptions } from './useCustomerOptions'
import type { ReportDepartment, SortState } from '@/types/reports'

// Stable identity (module scope, not a per-render literal) so the shared
// useReportTableFilterGroups memo only recomputes when the actual filter state changes.
const FILTER_CONFIG = {
  customerLabelKey: 'departments.filters.customer',
  statusLabelKey: 'departments.filters.locationStatus',
  customerFieldKey: 'customer_id',
  statusFieldKey: 'location_status',
}

// Owns local search/sort/pagination state and derives the flattened department rows from
// the shared customer→location→department tree, then registers its filters into the panel.
export default function DepartmentsTable() {
  const { t } = useTranslation('reports')
  const [search,  setSearch]  = useState('')
  const [drill,   setDrill]   = useState<ReportDepartment | null>(null)
  const [selectedCustomers, setSelectedCustomers] = useState<Array<string | number>>([])
  const [selectedStatuses,  setSelectedStatuses]  = useState<Array<string | number>>(['active'])
  const [sort,    setSort]    = useState<SortState>({ key: 'customer_name', dir: 'asc' })

  // Data lives in the shared hook (§3); derive the flattened department rows here.
  const { customers, loading } = useSmCustomerTree()
  const rows = useMemo<ReportDepartment[]>(() => customers.flatMap(c =>
    (c.locations ?? []).flatMap(l =>
      (l.departments ?? []).map(d => ({
        ...d,
        location_name:   l.name,
        location_id:     l.id,
        location_status: l.status,
        customer_name:   c.name,
        customer_id:     c.id,
      }))
    )
  ), [customers])

  // Deduped, alphabetised customer id/name pairs for the panel's search-select.
  const customerOptions = useCustomerOptions(rows)

  // Filter predicate: checks panel's customer/status selections.
  const filterPredicate = useCallback((r: ReportDepartment) => {
    if (selectedCustomers.length && !selectedCustomers.includes(r.customer_id as string))    return false
    if (selectedStatuses.length  && !selectedStatuses.includes(r.location_status as string)) return false
    return true
  }, [selectedCustomers, selectedStatuses])

  // Distinct location statuses seen in the data, for the panel's status filter chips.
  const statusOptions = useMemo(() => distinctSortedValues(rows, r => r.location_status), [rows])

  // Declarative filter-group config via the shared builder (§3 consolidation); memoised
  // so the panel doesn't re-render on every keystroke.
  const filterGroups = useReportTableFilterGroups({
    t, rows, customerOptions, statusOptions,
    selectedCustomers, setSelectedCustomers,
    selectedStatuses, setSelectedStatuses,
    config: FILTER_CONFIG,
  })

  // Consolidates filtered/sorted memo and registers filter groups with the shared panel.
  const { filtered, sorted } = useReportTableFilter({
    rows,
    search,
    sortState: sort,
    filterPredicate,
    searchFields: ['name', 'location_name', 'customer_name', 'cost_center'],
    sortKey: sort.key,
    filterGroupsConfig: filterGroups,
    tableId: 'departments-table',
  })

  // Shared paging/sort-toggle state (§3 consolidation) — page resets to 1 on any filter/size change.
  const { page, paged, totalPages, pageSize, handlePageSizeChange, setPage, setSort_ } = useReportPaging(sorted, setSort, 'asc')

  const COLS = [
    { key: 'customer_name', label: t('departments.cols.customer'),   sortable: true },
    { key: 'location_name', label: t('departments.cols.location'),   sortable: true },
    { key: 'name',          label: t('departments.cols.department'), sortable: true },
    { key: 'cost_center',   label: t('departments.cols.costCenter'), sortable: true },
  ]

  return (
    <div className="flex flex-col h-full">
      <ReportTableToolbar
        title={t('departments.title')}
        summary={loading ? t('common.loadingShort') : t('departments.summary', { shown: filtered.length, total: rows.length })}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder={t('departments.search')}
      />

      {/* DRY: the ReportPagedTableShell wiring mirrors LocationsTable's own call —
          both are already the maximal shared extraction (ReportPagedTableShell/
          ReportTableShell); the remaining overlap is each table's OWN column set
          and row cells (customer/location/name/cost-center here vs. name/customer/
          address/status/dept-count there), which cannot collapse further without
          losing the per-entity column shape. */}
      <ReportPagedTableShell
        loading={loading}
        loadingLabel={t('departments.loading')}
        empty={sorted.length === 0}
        emptyLabel={t('departments.empty')}
        columns={COLS} sort={sort} onSort={setSort_}
        rows={paged}
        renderRow={(r, i) => (
          <ReportRow key={r.id ?? i} onClick={() => setDrill(r)}>
            <td style={TD}>{r.customer_name}</td>
            <td style={TD}>{r.location_name}</td>
            <td style={{ ...TD, fontWeight: 500, color: 'var(--text)' }}>{r.name}</td>
            <td style={TD}>{renderMonospaceCell(r.cost_center)}</td>
          </ReportRow>
        )}
        page={page} totalPages={totalPages} totalRows={sorted.length}
        pageSize={pageSize} onPageChange={setPage} onPageSizeChange={handlePageSizeChange}
        drawer={drill && <DepartmentDrawer department={drill} onClose={() => setDrill(null)} />}
      />
    </div>
  )
}
