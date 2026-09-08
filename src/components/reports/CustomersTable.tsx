/**
 * CustomersTable — searchable, sortable, paginated table of customers.
 * Clicking a row opens CustomerDetailDrawer. Filters come from RightPanelContext,
 * page size from the user's preference; data is fetched per page from the API.
 * Chrome (sortable header + toolbar) and paging state come from the shared
 * reportTableChrome/useReportPaging (§3, "36-42 identical lines" consolidation).
 */
import { useState, useMemo, useCallback } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import CustomerDetailDrawer   from './CustomerDetailDrawer'
import PaginationBar          from '../ui/PaginationBar'
import { useReportPaging }    from './useReportPaging'
import useNumericColumnSort   from '@/hooks/useNumericColumnSort'
import { TD, SortableTableHead, ReportTableToolbar, ReportRow, ReportTableFrame } from './reportTableChrome'
import { useReportTableFilter } from './useReportTableFilter'
import { useReportCustomers } from './useReportCustomers'
import { renderStatusCell, renderCountCell, renderMonospaceCell } from './reportTableCells'
import type { ReportCustomer, SortState } from '@/types/reports'

// Read-only reports view of customers; data/loading/error come from the shared hook, filters register into the right panel below.
export default function CustomersTable() {
  const { t } = useTranslation('reports')
  // Data (fetch + dev-mock merge) lives in the shared hook (§3).
  const { customers, loading, error } = useReportCustomers()
  const [search,            setSearch]            = useState('')
  const [selectedStatuses,  setSelectedStatuses]  = useState<Array<string | number>>(['active'])
  const [sort,              setSort]              = useState<SortState>({ key: 'name', dir: 'asc' })
  const [detail,            setDetail]            = useState<ReportCustomer | null>(null)

  // Unique, sorted status values found in the current data set, used to build the filter panel options.
  const statusOptions = useMemo(() =>
    [...new Set(customers.map(c => c.status).filter((x): x is string => Boolean(x)))].sort(),
    [customers])

  const toggle = (setter: Dispatch<SetStateAction<Array<string | number>>>) => (val: string | number) =>
    setter(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val])

  // Filter predicate: checks status selection.
  const filterPredicate = useCallback((c: ReportCustomer) => {
    if (selectedStatuses.length && !selectedStatuses.includes(c.status as string)) return false
    return true
  }, [selectedStatuses])

  // Declares the status filter group registered into the shared right-hand filter panel.
  const filterGroups = useMemo(() => [
    {
      key: 'status', label: t('customers.filters.status'),
      selected: selectedStatuses,
      options: statusOptions.map(s => ({
        value: s,
        label: s === 'active' ? t('customers.statusActive') : s === 'inactive' ? t('customers.statusInactive') : s,
        count: customers.filter(c => c.status === s).length,
      })),
      onToggle: toggle(setSelectedStatuses),
    },
  ], [t, selectedStatuses, statusOptions, customers])

  // Consolidates filtered/sorted memo and registers filter groups with the shared panel.
  const { filtered, sorted: sortedAll } = useReportTableFilter({
    rows: customers,
    search,
    sortState: sort,
    filterPredicate,
    searchFields: ['name', 'debtor_number', 'account_manager', 'external_id'],
    sortKey: sort.key,
    filterGroupsConfig: filterGroups,
    tableId: 'customers-table',
  })

  // Apply numeric sorting for locations and departments columns.
  const locationsOf = useCallback((c: ReportCustomer) => c.locations?.length, [])
  const departmentsOf = useCallback((c: ReportCustomer) => (c.locations ?? []).reduce((s, l) => s + (l.departments?.length ?? 0), 0), [])
  const sortedLocs = useNumericColumnSort(sortedAll, sort, 'locations', locationsOf)
  const sorted = useNumericColumnSort(sortedLocs, sort, 'departments', departmentsOf)

  // Shared paging/sort-toggle state (§3 consolidation) — page resets to 1 on any filter/size change.
  const { page, paged, totalPages, pageSize, handlePageSizeChange, setPage, setSort_ } = useReportPaging(sorted, setSort, 'asc')

  const COLS = [
    { key: 'name',          label: t('customers.cols.name'),          sortable: true },
    { key: 'debtor_number', label: t('customers.cols.debtorNumber'),  sortable: true },
    { key: 'status',        label: t('customers.cols.status'),        sortable: true },
    { key: 'account_manager', label: t('customers.cols.accountManager'), sortable: true },
    { key: 'locations',     label: t('customers.cols.locations'),     sortable: true },
    { key: 'departments',   label: t('customers.cols.departments'),   sortable: true },
  ]

  return (
    <div className="flex flex-col h-full">

      <ReportTableToolbar
        title={t('customers.title')}
        summary={loading ? t('common.loadingShort') : t('customers.summary', { shown: filtered.length, total: customers.length })}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder={t('customers.search')}
      />

      {error && (
        <div style={{ padding: '10px 14px', marginBottom: 12, fontSize: 13,
                      // Ink is --color-on-danger-bg — the raw danger colour reads only
                      // 3.95:1 on its own pastel, AA fail (Opus r3.5).
                      color: 'var(--color-on-danger-bg)',
                      // eslint-disable-next-line no-restricted-syntax -- DATA: danger-border companion colour paired with the danger-bg tokens above; no exact token match for this specific soft-border shade
                      background: 'var(--color-danger-bg)', border: '1px solid #FECACA', borderRadius: 8 }}>
          {t('customers.loadError')}
        </div>
      )}

      {/* Table */}
      <ReportTableFrame
        loading={loading}
        loadingLabel={t('customers.loading')}
        empty={sorted.length === 0}
        emptyLabel={t('customers.empty')}
        spinner
        loadingHeight={240}
        emptyHeight={180}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <SortableTableHead columns={COLS} sort={sort} onSort={setSort_} />
          <tbody>
            {paged.map((c, i) => {
              const locCount  = c.locations?.length ?? 0
              const deptCount = (c.locations ?? []).reduce((s, l) => s + (l.departments?.length ?? 0), 0)
              return (
                <ReportRow key={c.id ?? i} onClick={() => setDetail(c)}>
                  <td style={TD}>
                    <span style={{ fontWeight: 500, color: 'var(--text)' }}>{c.name}</span>
                  </td>
                  <td style={TD}>{renderMonospaceCell(c.debtor_number)}</td>
                  <td style={TD}>{renderStatusCell(c.status)}</td>
                  <td style={TD}>{c.account_manager || <span style={{ color: 'var(--border)' }}>—</span>}</td>
                  <td style={TD}>{renderCountCell(locCount)}</td>
                  <td style={TD}>{renderCountCell(deptCount)}</td>
                </ReportRow>
              )
            })}
          </tbody>
        </table>
      </ReportTableFrame>

      <PaginationBar page={page} totalPages={totalPages} totalRows={sorted.length}
        pageSize={pageSize} onPageChange={setPage} onPageSizeChange={handlePageSizeChange} />

      {detail && (
        <CustomerDetailDrawer customer={detail} onClose={() => setDetail(null)} />
      )}
    </div>
  )
}
