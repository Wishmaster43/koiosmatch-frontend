import { useState, useEffect, useMemo } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import { useRightPanel } from '@/context/RightPanelContext'
import api, { unwrapList } from '@/lib/api'
import ErrorBanner from '@/components/ui/ErrorBanner'
import { isAbortError } from '@/lib/mocks'
import CustomersTable from './CustomersTable'
import CustomersInsightsRow from './CustomersInsightsRow'
import AddCustomerModal from './AddCustomerModal'
import type { CustomerForm } from './AddCustomerModal'
import PaginationBar from '@/components/ui/PaginationBar'
import { BTN_H } from '@/config/buttonMetrics'
import type { SmCustomerRow } from '@/types/shiftmanager'
import type { DonutSpec, KpiSpec } from '@/components/insights/InsightsRow'

import { initialsOf } from '@/lib/initials'

// Raw API/form customer (snake_case + camelCase tolerant) before mapping.
interface RawCustomer {
  id?: string | number
  name?: string
  debtor_number?: string; debtorNumber?: string
  status?: string
  account_manager?: string; accountManager?: string
  city?: string
  locations?: Array<{ departments?: unknown[] }>
  contacts?: unknown[]; contact_persons?: unknown[]
  created_at?: string; created?: string
  [k: string]: unknown
}

// Tokens only (§4) — never ad-hoc hex, so per-tenant theming (useTenantTheme) still applies here.
const STATUS_COLORS: Record<string, string> = {
  actief: 'var(--color-success)', prospect: 'var(--color-secondary)',
  inactief: 'var(--color-warning)', geblokkeerd: 'var(--color-danger)',
}
const deptCount = (c: SmCustomerRow) => (c.locations ?? []).reduce((s, l) => s + (l.departments?.length ?? 0), 0)

// Normalise a raw API customer into the shape the table/insights expect.
const mapCustomer = (c: RawCustomer): SmCustomerRow => ({
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

export default function CustomersPage() {
  const { t } = useTranslation('customers')
  const { registerFilters, unregisterFilters } = useRightPanel()

  const [customers, setCustomers] = useState<SmCustomerRow[]>([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)
  const [lastPage,  setLastPage]  = useState(1)
  const [total,     setTotal]     = useState(0)
  const [selected,  setSelected]  = useState<SmCustomerRow | null>(null)
  const [addOpen,   setAddOpen]   = useState(false)
  const [page,      setPage]      = useState(1)
  const [pageSize,  setPageSize]  = useState(25)

  const [globalSearch,   setGlobalSearch]   = useState('')
  const [selectedStatus, setSelectedStatus] = useState<string[]>([])
  const [selectedAM,     setSelectedAM]     = useState<string[]>([])
  const [selectedCity,   setSelectedCity]   = useState<string[]>([])

  useEffect(() => {
    const ctrl = new AbortController()
    setLoading(true)
    setError(null)
    api.get('/sm_customers', { params: { page, per_page: pageSize }, signal: ctrl.signal })
      .then(res => {
        const { rows, total: rowTotal, lastPage: rowLastPage } = unwrapList<RawCustomer>(res)
        setCustomers(rows.map(mapCustomer)); setTotal(rowTotal); setLastPage(rowLastPage)
      })
      .catch(err => {
        if (isAbortError(err)) return
        setError(t('page.loadError'))
        setCustomers([]); setTotal(0); setLastPage(1)
      })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false) })
    return () => ctrl.abort()
  }, [page, pageSize, t])

  // ── Filter option lists ──
  const optsFrom = (values: string[]) => {
    const counts: Record<string, number> = {}
    values.forEach(v => { counts[v] = (counts[v] ?? 0) + 1 })
    return Object.keys(counts).map(v => ({ value: v, label: v, count: counts[v] }))
  }
  const statusOptions = useMemo(() =>
    Object.keys(STATUS_COLORS).map(s => ({ value: s, label: t(`status.${s}`), count: customers.filter(c => c.status === s).length })).filter(o => o.count > 0)
  , [customers, t])
  const amOptions   = useMemo(() => optsFrom(customers.map(c => c.accountManager).filter((x): x is string => Boolean(x))), [customers])
  const cityOptions = useMemo(() => optsFrom(customers.map(c => c.city).filter((x): x is string => Boolean(x))), [customers])

  const tog = (set: Dispatch<SetStateAction<string[]>>) => (v: string) => set(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v])

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
      if (selectedStatus.length && !selectedStatus.includes(c.status as string))         return false
      if (selectedAM.length     && !selectedAM.includes(c.accountManager as string))     return false
      if (selectedCity.length   && !selectedCity.includes(c.city as string))             return false
      if (q && ![c.name, c.debtorNumber, c.accountManager, c.city].join(' ').toLowerCase().includes(q)) return false
      return true
    })
  }, [customers, globalSearch, selectedStatus, selectedAM, selectedCity])

  // ── Insights ──
  const pickKey = (d: unknown): string | undefined => {
    const x = d as { key?: string; payload?: { key?: string }; name?: string } | null | undefined
    return x?.key ?? x?.payload?.key ?? x?.name
  }
  const pickOne = (set: Dispatch<SetStateAction<string[]>>) => (v?: string) => { if (v != null) set(p => (p.length === 1 && p[0] === v) ? [] : [v]) }

  const statusData = useMemo(() =>
    statusOptions.map(o => ({ name: o.label, value: o.count, key: o.value, color: STATUS_COLORS[o.value] }))
  , [statusOptions])
  const amData = useMemo(() => amOptions.map(o => ({ name: o.label, value: o.count, key: o.value })), [amOptions])

  const totalLocations   = useMemo(() => customers.reduce((s, c) => s + (c.locations ?? []).length, 0), [customers])
  const totalDepartments = useMemo(() => customers.reduce((s, c) => s + deptCount(c), 0), [customers])
  const totalContacts    = useMemo(() => customers.reduce((s, c) => s + (c.contacts ?? []).length, 0), [customers])
  const noContactCount   = useMemo(() => customers.filter(c => (c.contacts ?? []).length === 0).length, [customers])

  // Keys live under the existing `insights.*` namespace (customers.json) —
  // never a second `analytics.*` source for the same strings (§5).
  const insightDonuts: DonutSpec[] = [
    { key: 'status', title: t('insights.statusTitle'), data: statusData, onPick: d => pickOne(setSelectedStatus)(pickKey(d)),
      active: selectedStatus.length > 0, onClear: () => setSelectedStatus([]) },
    { key: 'am',     title: t('insights.amTitle'),     data: amData,     onPick: d => pickOne(setSelectedAM)(pickKey(d)),
      active: selectedAM.length > 0,     onClear: () => setSelectedAM([]) },
  ]
  const insightKpis: KpiSpec[] = [
    { key: 'locations',   label: t('insights.locations'),   value: totalLocations,   sub: t('insights.locationsSub'),   color: 'var(--color-secondary)' },
    { key: 'departments', label: t('insights.departments'), value: totalDepartments, sub: t('insights.departmentsSub'), color: 'var(--color-violet)' },
    { key: 'contacts',    label: t('insights.contacts'),    value: totalContacts,    sub: t('insights.contactsSub'),    color: 'var(--color-primary)' },
    { key: 'noContact',   label: t('insights.noContact'),   value: noContactCount,   sub: t('insights.noContactSub'),   color: 'var(--color-danger)' },
  ]

  const onCreate = (form: CustomerForm) => setCustomers(prev => [mapCustomer({ ...form, debtor_number: form.debtorNumber, account_manager: form.accountManager, id: `new-${Date.now()}` }), ...prev])

  return (
    <>
      {addOpen && <AddCustomerModal onClose={() => setAddOpen(false)} onCreate={onCreate} />}
      <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          <CustomersInsightsRow donuts={insightDonuts} kpis={insightKpis} />

          {/* Toolbar row — the one shared spacing spec (§4): identical KPI-row→button gap everywhere */}
          <div style={{ padding: '0 24px 12px', minHeight: 36, display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
            {/* On-accent button text: '#fff' (not var(--surface), which is dark in dark mode and
                would fail contrast here) — matches the "+Add" button on every other entity page. */}
            {/* BTN_H (§4/§9): one explicit height for every text/action button, everywhere. */}
            <button onClick={() => setAddOpen(true)} style={{ display: 'flex', alignItems: 'center', marginLeft: 'auto', height: BTN_H, padding: '0 14px', fontSize: 13, fontWeight: 600,
              background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
              + {t('page.add')}
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 16px' }}>
            {error && <ErrorBanner style={{ marginBottom: 12 }}>{error}</ErrorBanner>}
            <CustomersTable rows={filtered} loading={loading} selectedId={selected?.id} onSelect={setSelected} />
          </div>

          <PaginationBar page={page} totalPages={lastPage} totalRows={total} pageSize={pageSize}
            onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1) }} />
        </div>
      </div>
    </>
  )
}
