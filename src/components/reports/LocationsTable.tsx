/**
 * LocationsTable — searchable, sortable, paginated table of locations.
 * Clicking a row opens LocationDrawer. Filters come from RightPanelContext,
 * page size from the user's preference; data is fetched per page from the API.
 * Chrome (sortable header + toolbar) and paging state come from the shared
 * reportTableChrome/useReportPaging (§3, "36-42 identical lines" consolidation).
 */
import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useRightPanel }      from '@/context/RightPanelContext'
import LocationDrawer         from './LocationDrawer'
import PaginationBar          from '../ui/PaginationBar'
import { useReportPaging }    from './useReportPaging'
import { TD, SortableTableHead, ReportTableToolbar } from './reportTableChrome'
import StatusBadge from '../ui/StatusBadge'  // shared active/inactive status pill
import { useSmCustomerTree } from '@/hooks/useSmCustomerTree'
import type { ReportLocation, SortState } from '@/types/reports'

// Searchable, sortable, paginated locations table; filters live in local state and are pushed into the shared right-panel context, and a row click opens the location drawer.
export default function LocationsTable() {
  const { t } = useTranslation('reports')
  const [search,           setSearch]           = useState('')
  const [drill,            setDrill]            = useState<ReportLocation | null>(null)
  const [selectedStatuses,  setSelectedStatuses]  = useState<Array<string | number>>(['active'])
  const [selectedCustomers, setSelectedCustomers] = useState<Array<string | number>>([])
  const [sort,              setSort]              = useState<SortState>({ key: 'customer_name', dir: 'asc' })

  const { registerFilters, unregisterFilters } = useRightPanel()

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
  const statusOptions = useMemo(() =>
    [...new Set(rows.map(r => r.status).filter((x): x is string => Boolean(x)))].sort(), [rows])

  // One option per customer, deduped via a Map keyed by id, for the customer filter list.
  const customerOptions = useMemo(() =>
    [...new Map(rows.map(r => [r.customer_id, r.customer_name] as [string | number, string | undefined])).entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '')),
    [rows])

  // Applies the active status/customer filters plus the free-text search (name/customer/address) in one pass.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter(r => {
      if (selectedStatuses.length  && !selectedStatuses.includes(r.status as string))      return false
      if (selectedCustomers.length && !selectedCustomers.includes(r.customer_id as string)) return false
      if (!q) return true
      return (
        (r.name          ?? '').toLowerCase().includes(q) ||
        (r.customer_name ?? '').toLowerCase().includes(q) ||
        (r.address       ?? '').toLowerCase().includes(q)
      )
    })
  }, [rows, search, selectedStatuses, selectedCustomers])

  // Sorts the filtered rows by the active column; dept_count is compared as a number so it does not sort lexically.
  const sorted = useMemo(() => {
    const { key, dir } = sort
    return [...filtered].sort((a, b) => {
      const av = key === 'dept_count' ? (a[key] ?? 0) : (a[key] ?? '').toString().toLowerCase()
      const bv = key === 'dept_count' ? (b[key] ?? 0) : (b[key] ?? '').toString().toLowerCase()
      if ((av as number) < (bv as number)) return dir === 'asc' ? -1 : 1
      if ((av as number) > (bv as number)) return dir === 'asc' ?  1 : -1
      return 0
    })
  }, [filtered, sort])

  // Shared paging/sort-toggle state (§3 consolidation) — page resets to 1 on any filter/size change.
  const { page, paged, totalPages, pageSize, handlePageSizeChange, setPage, setSort_ } = useReportPaging(sorted, setSort, 'asc')

  // Builds the customer/status filter definitions, with live per-option counts, handed to the shared right-panel filter UI.
  const filterGroups = useMemo(() => [
    {
      key: 'customer', label: t('locations.filters.customer'),
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
      key: 'status', label: t('locations.filters.status'),
      selected: selectedStatuses,
      options: statusOptions.map(s => ({
        value: s,
        label: s === 'active' ? t('common.statusActive') : s === 'inactive' ? t('common.statusInactive') : s,
        count: rows.filter(r => r.status === s).length,
      })),
      onToggle: (v: string | number) => setSelectedStatuses(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]),
    },
  ], [t, selectedCustomers, selectedStatuses, customerOptions, statusOptions, rows])

  // Registers this table's filter groups with the shared right panel, and unregisters them on unmount so they do not leak to another page.
  useEffect(() => {
    registerFilters('locations-table', filterGroups)
    return () => unregisterFilters('locations-table')
  }, [filterGroups, registerFilters, unregisterFilters])

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

      <div className="flex flex-1 min-h-0 overflow-hidden bg-[var(--surface)] rounded-xl"
        style={{ border: '1px solid var(--border)' }}>
        <div className="flex-1 min-w-0 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center" style={{ height: 200 }}>
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('locations.loading')}</p>
            </div>
          ) : sorted.length === 0 ? (
            <div className="flex items-center justify-center" style={{ height: 160 }}>
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('locations.empty')}</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <SortableTableHead columns={COLS} sort={sort} onSort={setSort_} />
              <tbody>
                {paged.map((r, i) => (
                  <tr key={r.id ?? i}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setDrill(r)}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ ...TD, fontWeight: 500, color: 'var(--text)' }}>{r.name}</td>
                    <td style={TD}>{r.customer_name}</td>
                    <td style={{ ...TD, color: 'var(--text-muted)', fontSize: 12 }}>{r.address || <span style={{ color: 'var(--border)' }}>—</span>}</td>
                    <td style={TD}><StatusBadge status={r.status} /></td>
                    <td style={TD}><span style={{ fontWeight: 500 }}>{r.dept_count}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <PaginationBar page={page} totalPages={totalPages} totalRows={sorted.length}
        pageSize={pageSize} onPageChange={setPage} onPageSizeChange={handlePageSizeChange} />

      {drill && <LocationDrawer location={drill} onClose={() => setDrill(null)} />}
    </div>
  )
}
