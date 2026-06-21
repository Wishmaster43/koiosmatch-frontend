/**
 * LocationsTable — searchable, sortable, paginated table of locations.
 * Clicking a row opens LocationDrawer. Filters come from RightPanelContext,
 * page size from the user's preference; data is fetched per page from the API.
 */
import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { useRightPanel }      from '../../context/RightPanelContext'
import { useAuth }            from '../../context/AuthContext'
import api                    from '../../lib/api'
import LocationDrawer         from './LocationDrawer'
import PaginationBar          from '../ui/PaginationBar'
import { useDefaultPageSize } from '../../lib/usePageSize'
import StatusBadge from '../ui/StatusBadge'  // shared active/inactive status pill


function SortIcon({ active, dir }) {
  if (!active) return <ChevronsUpDown size={12} style={{ color: '#D1D5DB' }} />
  return dir === 'asc'
    ? <ChevronUp size={12} style={{ color: 'var(--color-primary)' }} />
    : <ChevronDown size={12} style={{ color: 'var(--color-primary)' }} />
}

const TH = { padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600,
             color: '#9CA3AF', background: '#FAFAFA', borderBottom: '1px solid #F3F4F6',
             whiteSpace: 'nowrap', userSelect: 'none' }
const TD = { padding: '10px 12px', fontSize: 13, color: '#374151', borderBottom: '1px solid #F9FAFB' }

export default function LocationsTable() {
  const { t } = useTranslation('reports')
  const [rows,             setRows]             = useState([])
  const [loading,          setLoading]          = useState(true)
  const [search,           setSearch]           = useState('')
  const [drill,            setDrill]            = useState(null)
  const [selectedStatuses,  setSelectedStatuses]  = useState(['active'])
  const [selectedCustomers, setSelectedCustomers] = useState([])
  const [sort,              setSort]              = useState({ key: 'customer_name', dir: 'asc' })
  const defaultPageSize = useDefaultPageSize()
  const { refreshUser } = useAuth()
  const [page,     setPage]     = useState(1)
  const [pageSize, setPageSize] = useState(defaultPageSize)

  const { registerFilters, unregisterFilters } = useRightPanel()

  useEffect(() => {
    api.get('/sm_customers')
      .then(res => {
        const customers = res.data?.data ?? res.data ?? []
        const flat = customers.flatMap(c =>
          (c.locations ?? []).map(l => ({
            ...l,
            customer_name: c.name,
            customer_id:   c.id,
            dept_count:    l.departments?.length ?? 0,
            address: [l.street, l.house_number, l.postal_code, l.city].filter(Boolean).join(' '),
          }))
        )
        setRows(flat)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const statusOptions = useMemo(() =>
    [...new Set(rows.map(r => r.status).filter(Boolean))].sort(), [rows])

  const customerOptions = useMemo(() =>
    [...new Map(rows.map(r => [r.customer_id, r.customer_name])).entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [rows])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter(r => {
      if (selectedStatuses.length  && !selectedStatuses.includes(r.status))      return false
      if (selectedCustomers.length && !selectedCustomers.includes(r.customer_id)) return false
      if (!q) return true
      return (
        (r.name          ?? '').toLowerCase().includes(q) ||
        (r.customer_name ?? '').toLowerCase().includes(q) ||
        (r.address       ?? '').toLowerCase().includes(q)
      )
    })
  }, [rows, search, selectedStatuses, selectedCustomers])

  const sorted = useMemo(() => {
    const { key, dir } = sort
    return [...filtered].sort((a, b) => {
      const av = key === 'dept_count' ? (a[key] ?? 0) : (a[key] ?? '').toString().toLowerCase()
      const bv = key === 'dept_count' ? (b[key] ?? 0) : (b[key] ?? '').toString().toLowerCase()
      if (av < bv) return dir === 'asc' ? -1 : 1
      if (av > bv) return dir === 'asc' ?  1 : -1
      return 0
    })
  }, [filtered, sort])

  useEffect(() => setPage(1), [filtered.length, pageSize])
  const paged      = useMemo(() => sorted.slice((page-1)*pageSize, page*pageSize), [sorted, page, pageSize])
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))

  const handlePageSizeChange = async (n) => {
    setPageSize(n)
    try { await api.put('/auth/me', { default_per_page: n }); await refreshUser() } catch { /* noop */ }
  }

  const setSort_ = key => setSort(prev =>
    prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' })

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
      onToggle: v => setSelectedCustomers(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]),
    },
    {
      key: 'status', label: t('locations.filters.status'),
      selected: selectedStatuses,
      options: statusOptions.map(s => ({
        value: s,
        label: s === 'active' ? t('common.statusActive') : s === 'inactive' ? t('common.statusInactive') : s,
        count: rows.filter(r => r.status === s).length,
      })),
      onToggle: v => setSelectedStatuses(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]),
    },
  ], [t, selectedCustomers, selectedStatuses, customerOptions, statusOptions, rows])

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
      <div className="flex items-center justify-between flex-shrink-0" style={{ marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600, color: '#111827' }}>{t('locations.title')}</h1>
          <p style={{ fontSize: 13, color: '#9CA3AF', marginTop: 2 }}>
            {loading ? t('common.loadingShort') : t('locations.summary', { shown: filtered.length, total: rows.length })}
          </p>
        </div>
        <div className="relative">
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%',
                                     transform: 'translateY(-50%)', color: '#9CA3AF' }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={t('locations.search')}
            style={{ height: 34, width: 260, paddingLeft: 32, paddingRight: 12, fontSize: 13,
                     border: '1px solid #E5E7EB', borderRadius: 8, outline: 'none', color: '#374151' }} />
        </div>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden bg-white rounded-xl"
        style={{ border: '1px solid #F3F4F6' }}>
        <div className="flex-1 min-w-0 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center" style={{ height: 200 }}>
              <p style={{ fontSize: 13, color: '#9CA3AF' }}>{t('locations.loading')}</p>
            </div>
          ) : sorted.length === 0 ? (
            <div className="flex items-center justify-center" style={{ height: 160 }}>
              <p style={{ fontSize: 13, color: '#9CA3AF' }}>{t('locations.empty')}</p>
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
                    onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ ...TD, fontWeight: 500, color: '#111827' }}>{r.name}</td>
                    <td style={TD}>{r.customer_name}</td>
                    <td style={{ ...TD, color: '#6B7280', fontSize: 12 }}>{r.address || <span style={{ color: '#D1D5DB' }}>—</span>}</td>
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
