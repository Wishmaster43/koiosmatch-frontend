/**
 * LocationsTable — searchable, sortable, paginated table of locations.
 * Clicking a row opens LocationDrawer. Filters come from RightPanelContext,
 * page size from the user's preference; data is fetched per page from the API.
 * Chrome (sortable header + toolbar) and paging state come from the shared
 * reportTableChrome/useReportPaging (§3, "36-42 identical lines" consolidation).
 */
import { useState, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import LocationDrawer         from './LocationDrawer'
import { useReportPaging }    from './useReportPaging'
import useNumericColumnSort   from '@/hooks/useNumericColumnSort'
import { TD, ReportTableToolbar, ReportRow } from './reportTableChrome'
import { ReportPagedTableShell } from './ReportPagedTableShell'
import { distinctSortedValues } from './distinctSortedValues'
import { useReportTableFilter } from './useReportTableFilter'
import { useReportTableFilterGroups } from './useReportTableFilterGroups'
import CopyIconButton from '../ui/CopyIconButton'
import { renderStatusCell, renderCountCell } from './reportTableCells'
import { useSmCustomerTree } from '@/hooks/useSmCustomerTree'
import { useCustomerOptions } from './useCustomerOptions'
import type { ReportLocation, SortState } from '@/types/reports'

// Stable identity (module scope, not a per-render literal) so the shared
// useReportTableFilterGroups memo only recomputes when the actual filter state changes.
const FILTER_CONFIG = {
  customerLabelKey: 'locations.filters.customer',
  statusLabelKey: 'locations.filters.status',
  customerFieldKey: 'customer_id',
  statusFieldKey: 'status',
}

// Searchable, sortable, paginated locations table; filters live in local state and are pushed into the shared right-panel context, and a row click opens the location drawer.
export default function LocationsTable() {
  const { t } = useTranslation('reports')
  const [search,           setSearch]           = useState('')
  const [drill,            setDrill]            = useState<ReportLocation | null>(null)
  const [selectedStatuses,  setSelectedStatuses]  = useState<Array<string | number>>(['active'])
  const [selectedCustomers, setSelectedCustomers] = useState<Array<string | number>>([])
  const [sort,              setSort]              = useState<SortState>({ key: 'customer_name', dir: 'asc' })

  // Data lives in the shared hook (§3); derive the flattened location rows here.
  const { customers, loading } = useSmCustomerTree()
  const rows = useMemo<ReportLocation[]>(() => customers.flatMap(c =>
    (c.locations ?? []).map(l => ({
      ...l,
      customer_name: c.name,
      customer_id:   c.id,
      dept_count:    l.departments?.length ?? 0,
      address: [l.street, l.house_number, l.postal_code, l.city].filter(Boolean).join(' '),
    }))
  ), [customers])

  // Distinct status values present in the flattened rows, sorted, so the status filter only ever offers values that actually occur.
  const statusOptions = useMemo(() => distinctSortedValues(rows, r => r.status), [rows])

  // One option per customer, deduped via a Map keyed by id, for the customer filter list.
  const customerOptions = useCustomerOptions(rows)

  // Filter predicate: checks panel's status/customer selections.
  const filterPredicate = useCallback((r: ReportLocation) => {
    if (selectedStatuses.length  && !selectedStatuses.includes(r.status as string))      return false
    if (selectedCustomers.length && !selectedCustomers.includes(r.customer_id as string)) return false
    return true
  }, [selectedStatuses, selectedCustomers])

  // Builds the customer/status filter definitions via the shared builder.
  const filterGroups = useReportTableFilterGroups({
    t, rows, customerOptions, statusOptions,
    selectedCustomers, setSelectedCustomers,
    selectedStatuses, setSelectedStatuses,
    config: FILTER_CONFIG,
  })

  // Consolidates filtered/sorted memo and registers filter groups with the shared panel.
  const { filtered, sorted: sortedAll } = useReportTableFilter({
    rows,
    search,
    sortState: sort,
    filterPredicate,
    searchFields: ['name', 'customer_name', 'address'],
    sortKey: sort.key,
    filterGroupsConfig: filterGroups,
    tableId: 'locations-table',
  })

  // Apply numeric sorting for dept_count column.
  const deptCountOf = useCallback((r: ReportLocation) => r.dept_count, [])
  const sorted = useNumericColumnSort(sortedAll, sort, 'dept_count', deptCountOf)

  // Shared paging/sort-toggle state (§3 consolidation) — page resets to 1 on any filter/size change.
  const { page, paged, totalPages, pageSize, handlePageSizeChange, setPage, setSort_ } = useReportPaging(sorted, setSort, 'asc')

  const COLS = [
    { key: 'customer_name', label: t('locations.cols.customer'),    sortable: true },
    { key: 'name',          label: t('locations.cols.location'),    sortable: true },
    { key: 'address',       label: t('locations.cols.address'),     sortable: false },
    { key: 'status',        label: t('locations.cols.status'),      sortable: true },
    { key: 'dept_count',    label: t('locations.cols.departments'), sortable: true },
  ]

  return (
    <div className="flex flex-col h-full">
      <ReportTableToolbar
        title={t('locations.title')}
        summary={loading ? t('common.loadingShort') : t('locations.summary', { shown: filtered.length, total: rows.length })}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder={t('locations.search')}
      />

      <ReportPagedTableShell
        loading={loading}
        loadingLabel={t('locations.loading')}
        empty={sorted.length === 0}
        emptyLabel={t('locations.empty')}
        columns={COLS} sort={sort} onSort={setSort_}
        rows={paged}
        renderRow={(r, i) => (
          <ReportRow key={r.id ?? i} onClick={() => setDrill(r)}>
            <td style={{ ...TD, fontWeight: 500, color: 'var(--text)' }}>{r.name}</td>
            <td style={TD}>{r.customer_name}</td>
            <td style={{ ...TD, color: 'var(--text-muted)', fontSize: 12 }}>
              {r.address ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  {r.address}
                  {/* Stop the row-click drill-down from also firing when the copy icon is used. */}
                  <span onClick={e => e.stopPropagation()}><CopyIconButton label={t('common:copyAddress.copy')} copiedLabel={t('common:copyAddress.copied')} value={r.address} /></span>
                </span>
              ) : <span style={{ color: 'var(--border)' }}>—</span>}
            </td>
            <td style={TD}>{renderStatusCell(r.status)}</td>
            <td style={TD}>{renderCountCell(r.dept_count)}</td>
          </ReportRow>
        )}
        page={page} totalPages={totalPages} totalRows={sorted.length}
        pageSize={pageSize} onPageChange={setPage} onPageSizeChange={handlePageSizeChange}
        drawer={drill && <LocationDrawer location={drill} onClose={() => setDrill(null)} />}
      />
    </div>
  )
}
