import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useRightPanel } from '../../context/RightPanelContext'
import api, { unwrapList } from '../../lib/api'
import { USE_MOCKS, isAbortError } from '../../lib/mocks'
import CustomersTable from './CustomersTable'
import CustomersInsightsRow from './CustomersInsightsRow'
import AddCustomerModal from './AddCustomerModal'
import PaginationBar from '../../components/ui/PaginationBar'

const initialsOf = (name) => name ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?'
const STATUS_COLORS = { actief: '#16A34A', prospect: '#1B60A9', inactief: '#D97706', geblokkeerd: '#DC2626' }
const deptCount = (c) => (c.locations ?? []).reduce((s, l) => s + (l.departments?.length ?? 0), 0)

// Normalise a raw API customer into the shape the table/insights expect.
const mapCustomer = (c) => ({
  id:             c.id,
  name:           c.name ?? '—',
  initials:       initialsOf(c.name),
  debtorNumber:   c.debtor_number ?? c.debtorNumber ?? '',
  status:         c.status ?? 'prospect',
  accountManager: c.account_manager ?? c.accountManager ?? '',
  amInitials:     initialsOf(c.account_manager ?? c.accountManager),
  city:           c.city ?? '',
  locations:      c.locations ?? [],
  contacts:       c.contacts ?? c.contact_persons ?? [],
  created:        c.created_at ?? c.created ?? '',
})

// Temporary dummy data — replace once the API returns customers.
const DUMMY_CUSTOMERS = [
  { id: 1, name: 'Stichting Rivas Zorggroep', debtor_number: '10042', status: 'actief',   account_manager: 'Wiktoria Opalenyk', city: 'Gorinchem',  locations: [{ id: 1, departments: [{}, {}] }, { id: 2, departments: [{}] }], contacts: [{}, {}] },
  { id: 2, name: 'Zorggroep West',            debtor_number: '10088', status: 'actief',   account_manager: 'Kelly van Vliet',   city: 'Haarlem',    locations: [{ id: 3, departments: [{}, {}, {}] }],                      contacts: [{}] },
  { id: 3, name: 'Thuiszorg Noord',           debtor_number: '10103', status: 'actief',   account_manager: 'Wiktoria Opalenyk', city: 'Amsterdam',  locations: [{ id: 4, departments: [{}] }, { id: 5, departments: [{}, {}] }], contacts: [{}, {}, {}] },
  { id: 4, name: 'Zorggroep Oost',            debtor_number: '10120', status: 'prospect', account_manager: 'Bente de Jong',     city: 'Utrecht',    locations: [{ id: 6, departments: [{}] }],                              contacts: [] },
  { id: 5, name: 'Verpleeghuis De Linde',     debtor_number: '',       status: 'prospect', account_manager: 'Kelly van Vliet',   city: 'Eindhoven',  locations: [],                                                          contacts: [] },
  { id: 6, name: 'Woonzorg Centrum Zuid',     debtor_number: '10067', status: 'inactief', account_manager: 'Bente de Jong',     city: 'Breda',      locations: [{ id: 7, departments: [{}, {}] }],                          contacts: [{}] },
]

export default function CustomersPage() {
  const { t } = useTranslation('customers')
  const { registerFilters, unregisterFilters } = useRightPanel()

  const [customers, setCustomers] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(null)
  const [lastPage,  setLastPage]  = useState(1)
  const [total,     setTotal]     = useState(0)
  const [selected,  setSelected]  = useState(null)
  const [addOpen,   setAddOpen]   = useState(false)
  const [page,      setPage]      = useState(1)
  const [pageSize,  setPageSize]  = useState(25)

  const [globalSearch,   setGlobalSearch]   = useState('')
  const [selectedStatus, setSelectedStatus] = useState([])
  const [selectedAM,     setSelectedAM]     = useState([])
  const [selectedCity,   setSelectedCity]   = useState([])

  useEffect(() => {
    const ctrl = new AbortController()
    setLoading(true)
    setError(null)
    api.get('/sm_customers', { params: { page, per_page: pageSize }, signal: ctrl.signal })
      .then(res => {
        const { rows, total: rowTotal, lastPage: rowLastPage } = unwrapList(res)
        if (rows.length === 0 && USE_MOCKS) {
          setCustomers(DUMMY_CUSTOMERS.map(mapCustomer)); setTotal(DUMMY_CUSTOMERS.length); setLastPage(1)
        } else {
          setCustomers(rows.map(mapCustomer)); setTotal(rowTotal); setLastPage(rowLastPage)
        }
      })
      .catch(err => {
        if (isAbortError(err)) return
        if (USE_MOCKS) {
          setCustomers(DUMMY_CUSTOMERS.map(mapCustomer)); setTotal(DUMMY_CUSTOMERS.length); setLastPage(1)
        } else {
          setError(t('page.loadError', { defaultValue: 'Klanten laden is mislukt.' }))
          setCustomers([]); setTotal(0); setLastPage(1)
        }
      })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false) })
    return () => ctrl.abort()
  }, [page, pageSize, t])

  // ── Filter option lists ──
  const optsFrom = (values) => {
    const counts = {}
    values.forEach(v => { counts[v] = (counts[v] ?? 0) + 1 })
    return Object.keys(counts).map(v => ({ value: v, label: v, count: counts[v] }))
  }
  const statusOptions = useMemo(() =>
    Object.keys(STATUS_COLORS).map(s => ({ value: s, label: t(`status.${s}`), count: customers.filter(c => c.status === s).length })).filter(o => o.count > 0)
  , [customers, t])
  const amOptions   = useMemo(() => optsFrom(customers.map(c => c.accountManager).filter(Boolean)), [customers])
  const cityOptions = useMemo(() => optsFrom(customers.map(c => c.city).filter(Boolean)), [customers])

  const tog = (set) => (v) => set(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v])

  const catGeneral = t('filters.categories.general')

  const filterGroups = useMemo(() => [
    { key: 'global-search', type: 'global-search', label: t('filters.search'), placeholder: t('page.searchPlaceholder'), value: globalSearch, onChange: setGlobalSearch },
    { key: 'status',  type: 'search-select', category: catGeneral, label: t('filters.status'),         selected: selectedStatus, options: statusOptions, onToggle: tog(setSelectedStatus) },
    { key: 'am',      type: 'search-select', category: catGeneral, label: t('filters.accountManager'), selected: selectedAM,     options: amOptions,     onToggle: tog(setSelectedAM) },
    { key: 'city',    type: 'search-select', category: catGeneral, label: t('filters.city'),           selected: selectedCity,   options: cityOptions,   onToggle: tog(setSelectedCity) },
  ], [t, catGeneral, globalSearch, selectedStatus, selectedAM, selectedCity, statusOptions, amOptions, cityOptions])

  useEffect(() => {
    registerFilters('customers-page', filterGroups)
    return () => unregisterFilters('customers-page')
  }, [filterGroups, registerFilters, unregisterFilters])

  const filtered = useMemo(() => {
    const q = globalSearch.trim().toLowerCase()
    return customers.filter(c => {
      if (selectedStatus.length && !selectedStatus.includes(c.status))         return false
      if (selectedAM.length     && !selectedAM.includes(c.accountManager))     return false
      if (selectedCity.length   && !selectedCity.includes(c.city))             return false
      if (q && ![c.name, c.debtorNumber, c.accountManager, c.city].join(' ').toLowerCase().includes(q)) return false
      return true
    })
  }, [customers, globalSearch, selectedStatus, selectedAM, selectedCity])

  // ── Insights ──
  const pickKey = (d) => d?.key ?? d?.payload?.key ?? d?.name
  const pickOne = (set) => (v) => { if (v != null) set(p => (p.length === 1 && p[0] === v) ? [] : [v]) }

  const statusData = useMemo(() =>
    statusOptions.map(o => ({ name: o.label, value: o.count, key: o.value, color: STATUS_COLORS[o.value] }))
  , [statusOptions])
  const amData = useMemo(() => amOptions.map(o => ({ name: o.label, value: o.count, key: o.value })), [amOptions])

  const totalLocations   = useMemo(() => customers.reduce((s, c) => s + (c.locations ?? []).length, 0), [customers])
  const totalDepartments = useMemo(() => customers.reduce((s, c) => s + deptCount(c), 0), [customers])
  const totalContacts    = useMemo(() => customers.reduce((s, c) => s + (c.contacts ?? []).length, 0), [customers])
  const noContactCount   = useMemo(() => customers.filter(c => (c.contacts ?? []).length === 0).length, [customers])

  const insightDonuts = [
    { key: 'status', title: t('analytics.statusTitle'), data: statusData, onPick: d => pickOne(setSelectedStatus)(pickKey(d)),
      active: selectedStatus.length > 0, onClear: () => setSelectedStatus([]) },
    { key: 'am',     title: t('analytics.amTitle'),     data: amData,     onPick: d => pickOne(setSelectedAM)(pickKey(d)),
      active: selectedAM.length > 0,     onClear: () => setSelectedAM([]) },
  ]
  const insightKpis = [
    { key: 'locations',   label: t('analytics.locations'),   value: totalLocations,   sub: t('analytics.locationsSub'),   color: 'var(--color-secondary)' },
    { key: 'departments', label: t('analytics.departments'), value: totalDepartments, sub: t('analytics.departmentsSub'), color: '#8B5CF6' },
    { key: 'contacts',    label: t('analytics.contacts'),    value: totalContacts,    sub: t('analytics.contactsSub'),    color: 'var(--color-primary)' },
    { key: 'noContact',   label: t('analytics.noContact'),   value: noContactCount,   sub: t('analytics.noContactSub'),   color: 'var(--color-danger)' },
  ]

  const onCreate = (form) => setCustomers(prev => [mapCustomer({ ...form, debtor_number: form.debtorNumber, account_manager: form.accountManager, id: `new-${Date.now()}` }), ...prev])

  return (
    <>
      {addOpen && <AddCustomerModal onClose={() => setAddOpen(false)} onCreate={onCreate} />}
      <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          <CustomersInsightsRow donuts={insightDonuts} kpis={insightKpis} />

          <div style={{ padding: '0 24px 12px', display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
            <button onClick={() => setAddOpen(true)} style={{ marginLeft: 'auto', padding: '7px 14px', fontSize: 12, fontWeight: 500,
              background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
              + {t('page.add')}
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 16px' }}>
            {error && (
              <div className="mb-3 rounded-lg px-3 py-2.5 text-sm text-red-600 bg-red-50 border border-red-200">
                {error}
              </div>
            )}
            <CustomersTable rows={filtered} loading={loading} selectedId={selected?.id} onSelect={setSelected} />
          </div>

          <PaginationBar page={page} totalPages={lastPage} totalRows={total} pageSize={pageSize}
            onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1) }} />
        </div>
      </div>
    </>
  )
}
