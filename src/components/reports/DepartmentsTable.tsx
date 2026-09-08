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
import PaginationBar          from '../ui/PaginationBar'
import { useReportPaging }    from './useReportPaging'
import { TD, SortableTableHead, ReportTableToolbar, ReportRow, ReportTableFrame } from './reportTableChrome'
import { useReportTableFilter } from './useReportTableFilter'
import { renderMonospaceCell } from './reportTableCells'
import { useSmCustomerTree }  from '@/hooks/useSmCustomerTree'
import { useCustomerOptions } from './useCustomerOptions'
import type { ReportDepartment, SortState } from '@/types/reports'

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
  const statusOptions = useMemo(() =>
    [...new Set(rows.map(r => r.location_status).filter((x): x is string => Boolean(x)))].sort(), [rows])

  // Declarative filter-group config fed to RightPanelContext (§4: every filter lives in
  // the right-hand panel, never the toolbar); memoised so the panel doesn't re-render
  // on every keystroke.
  const filterGroups = useMemo(() => [
    {
      key: 'customer', label: t('departments.filters.customer'),
      type: 'search-select',
      selected: selectedCustomers,
      options: customerOptions.map(c => ({
        value: c.id,
        label: c.name,
        count: rows.filter(r => r.customer_id === c.id).length,
      })),
      onToggle: (v: string | number) => setSelectedCustomers(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]),
    },
    {
      key: 'status', label: t('departments.filters.locationStatus'),
      selected: selectedStatuses,
      options: statusOptions.map(s => ({
        value: s,
        label: s === 'active' ? t('common.statusActive') : s === 'inactive' ? t('common.statusInactive') : s,
        count: rows.filter(r => r.location_status === s).length,
      })),
      onToggle: (v: string | number) => setSelectedStatuses(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]),
    },
  ], [t, selectedCustomers, selectedStatuses, customerOptions, statusOptions, rows])

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

      <ReportTableFrame
        loading={loading}
        loadingLabel={t('departments.loading')}
        empty={sorted.length === 0}
        emptyLabel={t('departments.empty')}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <SortableTableHead columns={COLS} sort={sort} onSort={setSort_} />
          <tbody>
            {paged.map((r, i) => (
              <ReportRow key={r.id ?? i} onClick={() => setDrill(r)}>
                <td style={TD}>{r.customer_name}</td>
                <td style={TD}>{r.location_name}</td>
                <td style={{ ...TD, fontWeight: 500, color: 'var(--text)' }}>{r.name}</td>
                <td style={TD}>{renderMonospaceCell(r.cost_center)}</td>
              </ReportRow>
            ))}
          </tbody>
        </table>
      </ReportTableFrame>

      <PaginationBar page={page} totalPages={totalPages} totalRows={sorted.length}
        pageSize={pageSize} onPageChange={setPage} onPageSizeChange={handlePageSizeChange} />

      {drill && <DepartmentDrawer department={drill} onClose={() => setDrill(null)} />}
    </div>
  )
}
