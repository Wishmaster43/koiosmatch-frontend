/**
 * CustomersTable — searchable, sortable, paginated table of customers.
 * Clicking a row opens CustomerDetailDrawer. Filters come from RightPanelContext,
 * page size from the user's preference; data is fetched per page from the API.
 */
import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, ChevronUp, ChevronDown, ChevronsUpDown, RefreshCw } from 'lucide-react'
import { useRightPanel }      from '../../context/RightPanelContext'
import { useAuth }            from '../../context/AuthContext'
import CustomerDetailDrawer   from './CustomerDetailDrawer'
import api, { unwrapList }    from '../../lib/api'
import { USE_MOCKS }          from '../../lib/mocks'
import PaginationBar          from '../ui/PaginationBar'
import { useDefaultPageSize } from '../../lib/usePageSize'
import StatusBadge from '../ui/StatusBadge'  // shared active/inactive status pill

const DUMMY_CUSTOMERS = [
  {
    id: 'dummy-1', name: 'Zorgpartners Midden-Holland', debtor_number: 'DEB-1001',
    status: 'active', account_manager: 'Iris de Wit',
    locations: [
      {
        id: 'loc-1', name: 'Zorgpartners Midden-Holland HQ', status: 'active',
        street: 'Anna van Meertenstraat', house_number: '12', postal_code: '2804 TL', city: 'Gouda',
        departments: [
          { id: 'd1', name: 'Verpleging', cost_center: 'VP-001' },
          { id: 'd2', name: 'Verzorging IG', cost_center: 'VZ-002' },
          { id: 'd3', name: 'Helpende Plus', cost_center: 'HP-003' },
        ],
      },
      {
        id: 'loc-2', name: 'Centrum De Breeje Hendrick', status: 'active',
        street: 'Nicolaas Beetsstraat', house_number: '1', postal_code: '2941 TN', city: 'Lekkerkerk',
        departments: [
          { id: 'd4', name: 'Dagbesteding', cost_center: 'DB-004' },
          { id: 'd5', name: 'Revalidatie', cost_center: 'RV-005' },
        ],
      },
      {
        id: 'loc-3', name: 'Centrum Irishof', status: 'active',
        street: 'Middenmolenplein', house_number: '266', postal_code: '2803 ZR', city: 'Gouda',
        departments: [
          { id: 'd6', name: 'Verpleegkundige zorg', cost_center: 'VPK-006' },
        ],
      },
      {
        id: 'loc-4', name: 'Ronssehof / Ronssehof Revalidatie', status: 'active',
        street: 'Ronsseweg', house_number: '410', postal_code: '2803 ZX', city: 'Gouda',
        departments: [
          { id: 'd7', name: 'Revalidatie', cost_center: 'RV-007' },
          { id: 'd8', name: 'Geriatrie', cost_center: 'GR-008' },
        ],
      },
      {
        id: 'loc-5', name: 'Centrum De Hanepraij', status: 'active',
        street: 'Fluwelensingel', house_number: '110', postal_code: '2806 CH', city: 'Gouda',
        departments: [
          { id: 'd9', name: 'Verzorging', cost_center: 'VZ-009' },
          { id: 'd10', name: 'Helpende', cost_center: 'HL-010' },
        ],
      },
    ],
  },
  {
    id: 'dummy-2', name: 'Amsterdam UMC', debtor_number: 'DEB-1002',
    status: 'active', account_manager: 'Iris de Wit',
    locations: [
      {
        id: 'loc-6', name: 'Amsterdam UMC — Locatie AMC', status: 'active',
        street: 'Meibergdreef', house_number: '9', postal_code: '1105 AZ', city: 'Amsterdam',
        departments: [
          { id: 'd11', name: 'Cardiologie', cost_center: 'CAR-011' },
          { id: 'd12', name: 'Neurologie', cost_center: 'NEU-012' },
          { id: 'd13', name: 'Oncologie', cost_center: 'ONC-013' },
          { id: 'd14', name: 'Spoedeisende hulp', cost_center: 'SEH-014' },
        ],
      },
      {
        id: 'loc-7', name: 'Amsterdam UMC — Locatie VUmc', status: 'active',
        street: 'De Boelelaan', house_number: '1117', postal_code: '1081 HV', city: 'Amsterdam',
        departments: [
          { id: 'd15', name: 'Chirurgie', cost_center: 'CHR-015' },
          { id: 'd16', name: 'Psychiatrie', cost_center: 'PSY-016' },
        ],
      },
    ],
  },
  {
    id: 'dummy-3', name: 'Stichting Zuidwester', debtor_number: 'DEB-1003',
    status: 'active', account_manager: 'Iris de Wit',
    locations: [
      {
        id: 'loc-8', name: 'Zuidwester Hoofdkantoor', status: 'active',
        street: 'Kade', house_number: '2', postal_code: '3251 LB', city: 'Stellendam',
        departments: [
          { id: 'd17', name: 'Begeleiding', cost_center: 'BG-017' },
          { id: 'd18', name: 'Dagactiviteiten', cost_center: 'DA-018' },
        ],
      },
    ],
  },
  {
    id: 'dummy-4', name: 'Ikazia Ziekenhuis', debtor_number: 'DEB-1004',
    status: 'inactive', account_manager: 'Iris de Wit',
    locations: [
      {
        id: 'loc-9', name: 'Ikazia Rotterdam', status: 'inactive',
        street: 'Montessoriweg', house_number: '1', postal_code: '3083 AN', city: 'Rotterdam',
        departments: [
          { id: 'd19', name: 'Interne geneeskunde', cost_center: 'IG-019' },
          { id: 'd20', name: 'Verloskunde', cost_center: 'VL-020' },
          { id: 'd21', name: 'Kindergeneeskunde', cost_center: 'KG-021' },
        ],
      },
    ],
  },
]

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
  const { t } = useTranslation('reports')
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
    api.get('/sm/customers')
      .then(res => {
        const { rows: real } = unwrapList(res)
        if (USE_MOCKS) {
          const realIds = new Set(real.map(c => c.id))
          const dummies = DUMMY_CUSTOMERS.filter(d => !realIds.has(d.id))
          setCustomers([...dummies, ...real])
        } else {
          setCustomers(real)
        }
      })
      .catch(() => { setError(t('customers.loadError')); setCustomers(USE_MOCKS ? DUMMY_CUSTOMERS : []) })
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
    try { await api.put('/auth/me', { default_per_page: n }); await refreshUser() } catch { /* noop */ }
  }

  const setSort_ = (key) => setSort(prev =>
    prev.key === key
      ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      : { key, dir: 'asc' }
  )

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

  useEffect(() => {
    registerFilters('customers-table', filterGroups)
    return () => unregisterFilters('customers-table')
  }, [filterGroups, registerFilters, unregisterFilters])

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


      {error && (
        <div style={{ padding: '10px 14px', marginBottom: 12, fontSize: 13, color: 'var(--color-danger)',
                      background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8 }}>
          {error}
        </div>
      )}

      {/* Table */}
      <div className="flex flex-1 min-h-0 overflow-hidden bg-white rounded-xl"
        style={{ border: '1px solid #F3F4F6' }}>
        <div className="flex-1 min-w-0 overflow-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3" style={{ height: 240 }}>
              <RefreshCw size={18} className="animate-spin" style={{ color: '#D1D5DB' }} />
              <p style={{ fontSize: 13, color: '#9CA3AF' }}>{t('customers.loading')}</p>
            </div>
          ) : sorted.length === 0 ? (
            <div className="flex items-center justify-center" style={{ height: 180 }}>
              <p style={{ fontSize: 13, color: '#9CA3AF' }}>{t('customers.empty')}</p>
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
