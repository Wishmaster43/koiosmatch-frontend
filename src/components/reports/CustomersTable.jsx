import { useState, useEffect, useMemo } from 'react'
import { Search, ChevronUp, ChevronDown, ChevronsUpDown, RefreshCw } from 'lucide-react'
import { useRightPanel }      from '../../context/RightPanelContext'
import { useAuth }            from '../../context/AuthContext'
import CustomerDetailDrawer   from './CustomerDetailDrawer'
import api                    from '../../lib/api'
import PaginationBar          from '../ui/PaginationBar'
import { useDefaultPageSize } from '../../lib/usePageSize'

function StatusBadge({ status }) {
  const map = {
    active:   { bg: '#F0FDF4', color: '#16A34A', label: 'Actief' },
    inactive: { bg: '#FFF7ED', color: '#C2410C', label: 'Inactief' },
  }
  const s = map[status?.toLowerCase()] ?? { bg: '#F9FAFB', color: '#6B7280', label: status ?? 'onbekend' }
  return (
    <span style={{ background: s.bg, color: s.color, fontSize: 11, fontWeight: 500,
                   padding: '2px 8px', borderRadius: 999, whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  )
}

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

export default function CustomersTable() {
  const [customers,         setCustomers]         = useState([])
  const [loading,           setLoading]           = useState(true)
  const [error,             setError]             = useState(null)
  const [search,            setSearch]            = useState('')
  const [selectedStatuses,  setSelectedStatuses]  = useState(['active'])
  const [sort,              setSort]              = useState({ key: 'name', dir: 'asc' })
  const defaultPageSize = useDefaultPageSize()
  const { refreshUser } = useAuth()
  const [page,     setPage]     = useState(1)
  const [pageSize, setPageSize] = useState(defaultPageSize)
  const [detail,            setDetail]            = useState(null)

  const { registerFilters, unregisterFilters } = useRightPanel()

  const load = () => {
    setLoading(true)
    setError(null)
    api.get('/customers')
      .then(res => {
        const data = res.data
        setCustomers(Array.isArray(data) ? data : (data?.data ?? []))
      })
      .catch(() => setError('Kon klanten niet laden.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const statusOptions = useMemo(() =>
    [...new Set(customers.map(c => c.status).filter(Boolean))].sort(),
    [customers])

  const toggle = (setter) => (val) =>
    setter(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return customers.filter(c => {
      if (selectedStatuses.length && !selectedStatuses.includes(c.status)) return false
      if (!q) return true
      return (
        (c.name             ?? '').toLowerCase().includes(q) ||
        (c.debtor_number    ?? '').toLowerCase().includes(q) ||
        (c.account_manager  ?? '').toLowerCase().includes(q) ||
        (c.external_id      ?? '').toString().includes(q)
      )
    })
  }, [customers, search, selectedStatuses])

  const sorted = useMemo(() => {
    const { key, dir } = sort
    return [...filtered].sort((a, b) => {
      let av, bv
      if (key === 'locations')   { av = a.locations?.length ?? 0;  bv = b.locations?.length ?? 0 }
      else if (key === 'departments') {
        av = (a.locations ?? []).reduce((s, l) => s + (l.departments?.length ?? 0), 0)
        bv = (b.locations ?? []).reduce((s, l) => s + (l.departments?.length ?? 0), 0)
      } else {
        av = (a[key] ?? '').toString().toLowerCase()
        bv = (b[key] ?? '').toString().toLowerCase()
      }
      if (av < bv) return dir === 'asc' ? -1 : 1
      if (av > bv) return dir === 'asc' ? 1  : -1
      return 0
    })
  }, [filtered, sort])

  useEffect(() => setPage(1), [filtered.length, pageSize])
  const paged     = useMemo(() => sorted.slice((page-1)*pageSize, page*pageSize), [sorted, page, pageSize])
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))

  const handlePageSizeChange = async (n) => {
    setPageSize(n)
    try { await api.put('/auth/me', { default_per_page: n }); await refreshUser() } catch {}
  }

  const setSort_ = (key) => setSort(prev =>
    prev.key === key
      ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      : { key, dir: 'asc' }
  )

  const filterGroups = useMemo(() => [
    {
      key: 'status', label: 'Status',
      selected: selectedStatuses,
      options: statusOptions.map(s => ({
        value: s,
        label: s === 'active' ? 'Actief' : s === 'inactive' ? 'Inactief' : s,
        count: customers.filter(c => c.status === s).length,
      })),
      onToggle: toggle(setSelectedStatuses),
    },
  ], [selectedStatuses, statusOptions, customers])

  useEffect(() => {
    registerFilters('customers-table', filterGroups)
    return () => unregisterFilters('customers-table')
  }, [filterGroups, registerFilters, unregisterFilters])

  const COLS = [
    { key: 'name',          label: 'Naam',           sortable: true },
    { key: 'debtor_number', label: 'Debiteur-nr',    sortable: true },
    { key: 'status',        label: 'Status',         sortable: true },
    { key: 'account_manager', label: 'Accountmanager', sortable: true },
    { key: 'locations',     label: 'Locaties',       sortable: true },
    { key: 'departments',   label: 'Afdelingen',     sortable: true },
  ]

  return (
    <div className="flex flex-col h-full">

      {/* Toolbar */}
      <div className="flex items-center justify-between flex-shrink-0" style={{ marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600, color: '#111827' }}>Details — Klanten</h1>
          <p style={{ fontSize: 13, color: '#9CA3AF', marginTop: 2 }}>
            {loading ? 'Laden…' : `${filtered.length} van ${customers.length} klanten`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%',
                                       transform: 'translateY(-50%)', color: '#9CA3AF' }} />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Zoek op naam, debiteur, accountmanager…"
              style={{ height: 34, width: 280, paddingLeft: 32, paddingRight: 12, fontSize: 13,
                       border: '1px solid #E5E7EB', borderRadius: 8, outline: 'none', color: '#374151' }} />
          </div>
        </div>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', marginBottom: 12, fontSize: 13, color: '#DC2626',
                      background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8 }}>
          {error}
        </div>
      )}

      {/* Tabel */}
      <div className="flex flex-1 min-h-0 overflow-hidden bg-white rounded-xl"
        style={{ border: '1px solid #F3F4F6' }}>
        <div className="flex-1 min-w-0 overflow-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3" style={{ height: 240 }}>
              <RefreshCw size={18} className="animate-spin" style={{ color: '#D1D5DB' }} />
              <p style={{ fontSize: 13, color: '#9CA3AF' }}>Klanten ophalen…</p>
            </div>
          ) : sorted.length === 0 ? (
            <div className="flex items-center justify-center" style={{ height: 180 }}>
              <p style={{ fontSize: 13, color: '#9CA3AF' }}>Geen klanten gevonden</p>
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
                {paged.map((c, i) => {
                  const locCount  = c.locations?.length ?? 0
                  const deptCount = (c.locations ?? []).reduce((s, l) => s + (l.departments?.length ?? 0), 0)
                  return (
                    <tr key={c.id ?? i}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setDetail(c)}
                      onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={TD}>
                        <span style={{ fontWeight: 500, color: '#111827' }}>{c.name}</span>
                      </td>
                      <td style={TD}>
                        <span style={{ fontFamily: 'monospace', fontSize: 12 }}>
                          {c.debtor_number || <span style={{ color: '#D1D5DB' }}>—</span>}
                        </span>
                      </td>
                      <td style={TD}><StatusBadge status={c.status} /></td>
                      <td style={TD}>{c.account_manager || <span style={{ color: '#D1D5DB' }}>—</span>}</td>
                      <td style={TD}>
                        <span style={{ fontWeight: 500 }}>{locCount}</span>
                        {locCount === 0 && <span style={{ color: '#D1D5DB', marginLeft: 4, fontSize: 11 }}>—</span>}
                      </td>
                      <td style={TD}>
                        <span style={{ fontWeight: 500 }}>{deptCount}</span>
                        {deptCount === 0 && <span style={{ color: '#D1D5DB', marginLeft: 4, fontSize: 11 }}>—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <PaginationBar page={page} totalPages={totalPages} totalRows={sorted.length}
        pageSize={pageSize} onPageChange={setPage} onPageSizeChange={handlePageSizeChange} />

      {detail && (
        <CustomerDetailDrawer customer={detail} onClose={() => setDetail(null)} />
      )}
    </div>
  )
}
