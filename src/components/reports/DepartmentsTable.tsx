/**
 * DepartmentsTable — searchable, sortable, paginated table of departments.
 * Clicking a row opens DepartmentDrawer. Filters come from RightPanelContext,
 * page size from the user's preference; data is fetched per page from the API.
 * Chrome (sortable header + toolbar) and paging state come from the shared
 * reportTableChrome/useReportPaging (§3, "36-42 identical lines" consolidation).
 */
import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useRightPanel }      from '@/context/RightPanelContext'
import DepartmentDrawer       from './DepartmentDrawer'
import PaginationBar          from '../ui/PaginationBar'
import { useReportPaging }    from './useReportPaging'
import { TD, SortableTableHead, ReportTableToolbar } from './reportTableChrome'
import { useSmCustomerTree }  from '@/hooks/useSmCustomerTree'
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

  const { registerFilters, unregisterFilters } = useRightPanel()

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

  // Deduped, alphabetised customer id/name pairs for the panel's search-select — only
  // rebuilds when the underlying rows change, not on every search keystroke.
  const customerOptions = useMemo(() =>
    [...new Map(rows.map(r => [r.customer_id, r.customer_name] as [string | number, string | undefined])).entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '')),
    [rows])

  // Applies the panel's customer/status selections plus the free-text search across
  // department, location, customer and cost-center fields.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter(r => {
      if (selectedCustomers.length && !selectedCustomers.includes(r.customer_id as string))    return false
      if (selectedStatuses.length  && !selectedStatuses.includes(r.location_status as string)) return false
      if (!q) return true
      return (
        (r.name          ?? '').toLowerCase().includes(q) ||
        (r.location_name ?? '').toLowerCase().includes(q) ||
        (r.customer_name ?? '').toLowerCase().includes(q) ||
        (r.cost_center   ?? '').toLowerCase().includes(q)
      )
    })
  }, [rows, search, selectedCustomers, selectedStatuses])

  // Applies the active column/direction on top of the filtered rows; recomputes only
  // when the filter result or the sort state changes.
  const sorted = useMemo(() => {
    const { key, dir } = sort
    return [...filtered].sort((a, b) => {
      const av = (a[key] ?? '').toString().toLowerCase()
      const bv = (b[key] ?? '').toString().toLowerCase()
      if (av < bv) return dir === 'asc' ? -1 : 1
      if (av > bv) return dir === 'asc' ?  1 : -1
      return 0
    })
  }, [filtered, sort])

  // Shared paging/sort-toggle state (§3 consolidation) — page resets to 1 on any filter/size change.
  const { page, paged, totalPages, pageSize, handlePageSizeChange, setPage, setSort_ } = useReportPaging(sorted, setSort, 'asc')

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

  // Registers this table's filter groups with the shared right panel on mount/change,
  // and unregisters them on cleanup so a stale group doesn't linger for another table.
  useEffect(() => {
    registerFilters('departments-table', filterGroups)
    return () => unregisterFilters('departments-table')
  }, [filterGroups, registerFilters, unregisterFilters])

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

      <div className="flex flex-1 min-h-0 overflow-hidden bg-[var(--surface)] rounded-xl"
        style={{ border: '1px solid var(--border)' }}>
        <div className="flex-1 min-w-0 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center" style={{ height: 200 }}>
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('departments.loading')}</p>
            </div>
          ) : sorted.length === 0 ? (
            <div className="flex items-center justify-center" style={{ height: 160 }}>
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('departments.empty')}</p>
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
                    <td style={TD}>{r.customer_name}</td>
                    <td style={TD}>{r.location_name}</td>
                    <td style={{ ...TD, fontWeight: 500, color: 'var(--text)' }}>{r.name}</td>
                    <td style={TD}>
                      {r.cost_center
                        ? <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.cost_center}</span>
                        : <span style={{ color: 'var(--border)' }}>—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <PaginationBar page={page} totalPages={totalPages} totalRows={sorted.length}
        pageSize={pageSize} onPageChange={setPage} onPageSizeChange={handlePageSizeChange} />

      {drill && <DepartmentDrawer department={drill} onClose={() => setDrill(null)} />}
    </div>
  )
}
