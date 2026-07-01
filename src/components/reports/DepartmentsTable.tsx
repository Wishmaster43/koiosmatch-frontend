/**
 * DepartmentsTable — searchable, sortable, paginated table of departments.
 * Clicking a row opens DepartmentDrawer. Filters come from RightPanelContext,
 * page size from the user's preference; data is fetched per page from the API.
 */
import { useState, useEffect, useMemo } from 'react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { useRightPanel }      from '@/context/RightPanelContext'
import DepartmentDrawer       from './DepartmentDrawer'
import PaginationBar          from '../ui/PaginationBar'
import { usePersistedPageSize } from '@/hooks/usePersistedPageSize'
import { useSmCustomerTree }  from '@/hooks/useSmCustomerTree'
import type { ReportDepartment, SortState } from '@/types/reports'

function SortIcon({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  if (!active) return <ChevronsUpDown size={12} style={{ color: 'var(--border)' }} />
  return dir === 'asc'
    ? <ChevronUp size={12} style={{ color: 'var(--color-primary)' }} />
    : <ChevronDown size={12} style={{ color: 'var(--color-primary)' }} />
}

const TH: CSSProperties = { padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600,
             color: 'var(--text-muted)', background: 'var(--hover-bg)', borderBottom: '1px solid var(--border)',
             whiteSpace: 'nowrap', userSelect: 'none' }
const TD: CSSProperties = { padding: '10px 12px', fontSize: 13, color: 'var(--text)', borderBottom: '1px solid var(--hover-bg)' }

export default function DepartmentsTable() {
  const { t } = useTranslation('reports')
  const [search,  setSearch]  = useState('')
  const [drill,   setDrill]   = useState<ReportDepartment | null>(null)
  const [selectedCustomers, setSelectedCustomers] = useState<Array<string | number>>([])
  const [selectedStatuses,  setSelectedStatuses]  = useState<Array<string | number>>(['active'])
  const [sort,    setSort]    = useState<SortState>({ key: 'customer_name', dir: 'asc' })
  const [page, setPage] = useState(1)
  const { pageSize, handlePageSizeChange } = usePersistedPageSize()

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

  const customerOptions = useMemo(() =>
    [...new Map(rows.map(r => [r.customer_id, r.customer_name] as [string | number, string | undefined])).entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '')),
    [rows])

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

  useEffect(() => setPage(1), [filtered.length, pageSize])
  const paged      = useMemo(() => sorted.slice((page-1)*pageSize, page*pageSize), [sorted, page, pageSize])
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))

  const setSort_ = (key: string) => setSort(prev =>
    prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' })

  const statusOptions = useMemo(() =>
    [...new Set(rows.map(r => r.location_status).filter((x): x is string => Boolean(x)))].sort(), [rows])

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
      <div className="flex items-center justify-between flex-shrink-0" style={{ marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)' }}>{t('departments.title')}</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
            {loading ? t('common.loadingShort') : t('departments.summary', { shown: filtered.length, total: rows.length })}
          </p>
        </div>
        <div className="relative">
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%',
                                     transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={t('departments.search')}
            style={{ height: 34, width: 260, paddingLeft: 32, paddingRight: 12, fontSize: 13,
                     border: '1px solid var(--border)', borderRadius: 8, outline: 'none', color: 'var(--text)' }} />
        </div>
      </div>

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
              <thead>
                <tr>
                  {COLS.map(col => (
                    <th key={col.key} style={TH}
                      onClick={() => col.sortable && setSort_(col.key)}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4,
                                    cursor: col.sortable ? 'pointer' : 'default' }}>
                        {col.label}
                        {col.sortable && <SortIcon active={sort.key === col.key} dir={sort.dir} />}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
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
