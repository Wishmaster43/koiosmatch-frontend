import { useState, useEffect, useMemo, useRef } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, AlertTriangle, X } from 'lucide-react'
import { useRightPanel } from '../../context/RightPanelContext'
import { useAuth } from '../../context/AuthContext'
import api, { unwrapList } from '../../lib/api'
import { isAbortError } from '../../lib/mocks'
import { useUsers } from '../../lib/queries'
import { useCustomerLookups } from '../../lib/useCustomerLookups'
import InsightsRow from '../../components/insights/InsightsRow'
import type { DonutSpec, KpiSpec } from '../../components/insights/InsightsRow'
import PaginationBar from '../../components/ui/PaginationBar'
import CustomersTable from './CustomersTable'
import CustomersBulkBar from './CustomersBulkBar'
import CustomerDrawer from './CustomerDrawer'
import AddCustomerModal from './AddCustomerModal'
import AddLocationModal from './AddLocationModal'
import AddDepartmentModal from './AddDepartmentModal'
import AddContactPersonModal from './AddContactPersonModal'
import { mapCustomer } from './data/mapCustomer'
import { initialsOf } from '@/lib/initials'
import type { Customer, ApiCustomer } from '../../types/customer'
import type { Id } from '../../types/common'

interface AppUser { id: Id; name: string; avatar_color?: string }
interface Opt { value: Id; label: string; count: number }
interface PageStats {
  by_status?: Array<{ value?: string; status?: string; count?: number }>
  by_owner?: Array<{ id?: Id; owner_id?: Id; name?: string; count?: number }>
  locations?: number; departments?: number; contacts?: number
  open_vacancies?: number; active_matches?: number; without_contact?: number
}
type NotePayload = { type: string; title: string; body: string }
interface SubAddState { type: string; customer: Customer }

// Recharts hands the clicked segment both at top level and under `.payload`.
const pickKey = (d: unknown): string | undefined => {
  const o = d as { key?: string; name?: string; payload?: { key?: string } } | null | undefined
  return o?.key ?? o?.payload?.key ?? o?.name
}
const toggleOneValue = (set: Dispatch<SetStateAction<string[]>>, value: string) => set(p => (p.length === 1 && p[0] === value) ? [] : [value])

export default function CustomersPage() {
  const { t } = useTranslation('customers')
  const { registerFilters, unregisterFilters } = useRightPanel()
  const auth = useAuth()
  const hasPermission = auth?.hasPermission ?? (() => false)
  const { data: users = [] } = useUsers() as { data?: AppUser[] }
  const { statuses, statusMeta } = useCustomerLookups()

  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)
  const [page,      setPage]      = useState(1)
  // TODO C-33: use user.default_per_page once the backend accepts per_page > 100 on this endpoint.
  const [pageSize,  setPageSize]  = useState(50)
  const [lastPage,  setLastPage]  = useState(1)
  const [total,     setTotal]     = useState(0)
  const [stats,     setStats]     = useState<PageStats | null>(null)
  const [selected,  setSelected]  = useState<Customer | null>(null)
  const [detail,    setDetail]    = useState<Customer | null>(null)
  const [drawerExpanded, setDrawerExpanded] = useState(false)
  const [addOpen,   setAddOpen]   = useState(false)
  const [subAdd,    setSubAdd]    = useState<SubAddState | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<Id>>(() => new Set())
  const [actionMsg, setActionMsg] = useState<{ type: string; text: string } | null>(null)
  const msgTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Filter dimensions (server-side).
  const [globalSearch,     setGlobalSearch]     = useState('')
  const [selectedStatus,   setSelectedStatus]   = useState<string[]>([])
  const [selectedOwner,    setSelectedOwner]    = useState<string[]>([])
  const [selectedCity,     setSelectedCity]     = useState<string[]>([])
  const [selectedIndustry, setSelectedIndustry] = useState<string[]>([])

  // Server-side filter params (axios serialises arrays as `key[]`).
  const filterParams = useMemo(() => {
    const p: Record<string, unknown> = {}
    if (globalSearch.trim())     p.search   = globalSearch.trim()
    if (selectedStatus.length)   p.status   = selectedStatus
    if (selectedOwner.length)    p.owner_id = selectedOwner
    if (selectedCity.length)     p.city     = selectedCity
    if (selectedIndustry.length) p.industry = selectedIndustry
    return p
  }, [globalSearch, selectedStatus, selectedOwner, selectedCity, selectedIndustry])
  const filterKey = JSON.stringify(filterParams)

  useEffect(() => { setPage(1) }, [filterKey])
  useEffect(() => { setSelectedIds(new Set()) }, [filterKey, page, pageSize])

  // ── List (paginated, server-filtered) ──
  useEffect(() => {
    const ctrl = new AbortController()
    setLoading(true); setError(null)
    api.get('/customers', { params: { ...filterParams, page, per_page: pageSize }, signal: ctrl.signal })
      .then(res => {
        const { rows, total, lastPage } = unwrapList<ApiCustomer>(res)
        setCustomers(rows.map(mapCustomer)); setTotal(total); setLastPage(lastPage)
      })
      .catch(err => {
        if (isAbortError(err)) return
        // A 404 means the endpoint isn't built yet → treat as empty, not an error.
        if (err?.response?.status && err.response.status !== 404) setError(t('page.loadError'))
        setCustomers([]); setTotal(0); setLastPage(1)
      })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false) })
    return () => ctrl.abort()
  }, [filterKey, page, pageSize, t]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Stats (server-wide totals, honour the filters) ──
  useEffect(() => {
    const ctrl = new AbortController()
    api.get('/customers/stats', { params: filterParams, signal: ctrl.signal })
      .then(res => setStats(res.data?.data ?? res.data ?? null))
      .catch(err => { if (!isAbortError(err)) setStats(null) })
    return () => ctrl.abort()
  }, [filterKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Option lists (stats first, page-derived as fallback) ──
  const optsFrom = (values: string[]): Opt[] => {
    const counts: Record<string, number> = {}
    values.forEach(v => { counts[v] = (counts[v] ?? 0) + 1 })
    return Object.keys(counts).map(v => ({ value: v, label: v, count: counts[v] }))
  }
  // Use the stable `statuses` array for label/colour lookup (NOT statusMeta —
  // that's a fresh function each render and would loop the filter registration).
  const statusOf = (v: string) => statuses.find(s => s.value === v)
  const statusOptions = useMemo<Opt[]>(() =>
    stats?.by_status
      ? stats.by_status.map(o => { const v = (o.value ?? o.status ?? '') as Id; return { value: v, label: statuses.find(s => s.value === v)?.label ?? String(v), count: o.count ?? 0 } })
      : statuses.map(s => ({ value: s.value, label: s.label, count: customers.filter(c => c.status === s.value).length })).filter(o => o.count > 0)
  , [stats, customers, statuses])
  const ownerOptions = useMemo<Opt[]>(() => {
    if (stats?.by_owner) return stats.by_owner.map(o => ({ value: (o.id ?? o.owner_id ?? '') as Id, label: o.name || '—', count: o.count ?? 0 })).filter(o => o.value !== '')
    const m: Record<string, Opt> = {}
    customers.forEach(c => { if (c.ownerId != null) { const key = String(c.ownerId); (m[key] ??= { value: c.ownerId as Id, label: c.owner || '—', count: 0 }).count++ } })
    return Object.values(m)
  }, [stats, customers])
  const cityOptions     = useMemo(() => optsFrom(customers.map(c => c.city).filter(Boolean)), [customers])
  const industryOptions = useMemo(() => optsFrom(customers.map(c => c.industry).filter(Boolean)), [customers])

  const tog = (set: Dispatch<SetStateAction<string[]>>) => (v: string) => set(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v])
  const pickOne = (set: Dispatch<SetStateAction<string[]>>) => (v: string | undefined) => { if (v != null) toggleOneValue(set, v) }

  const catGeneral = t('filters.categories.general')
  const catOrg     = t('filters.categories.organisation')

  const filterGroups = useMemo(() => [
    { key: 'global-search', type: 'global-search', label: t('filters.search'), placeholder: t('page.searchPlaceholder'), value: globalSearch, onChange: setGlobalSearch },
    { key: 'status',   type: 'search-select', category: catGeneral, label: t('filters.status'),         selected: selectedStatus,   options: statusOptions,   onToggle: tog(setSelectedStatus) },
    { key: 'industry', type: 'search-select', category: catGeneral, label: t('filters.industry'),       selected: selectedIndustry, options: industryOptions, onToggle: tog(setSelectedIndustry) },
    { key: 'city',     type: 'search-select', category: catGeneral, label: t('filters.city'),           selected: selectedCity,     options: cityOptions,     onToggle: tog(setSelectedCity) },
    { key: 'owner',    type: 'search-select', category: catOrg,     label: t('filters.accountManager'), selected: selectedOwner,    options: ownerOptions,    onToggle: tog(setSelectedOwner) },
  ], [t, catGeneral, catOrg, globalSearch, selectedStatus, selectedIndustry, selectedCity, selectedOwner, statusOptions, industryOptions, cityOptions, ownerOptions])

  useEffect(() => {
    registerFilters('customers-page', filterGroups)
    return () => unregisterFilters('customers-page')
  }, [filterGroups, registerFilters, unregisterFilters])

  // ── Insights: 2 donuts (status, account manager) + KPI cards ──
  const statusData = useMemo(() => statusOptions.map(o => ({ name: o.label, value: o.count, key: String(o.value), color: statusOf(String(o.value))?.color })), [statusOptions, statuses]) // eslint-disable-line react-hooks/exhaustive-deps
  const ownerData  = useMemo(() => ownerOptions.map(o => ({ name: o.label, value: o.count, key: String(o.value) })), [ownerOptions])

  const totalLocations   = stats?.locations   ?? customers.reduce((s, c) => s + c.locationsCount, 0)
  const totalDepartments = stats?.departments ?? customers.reduce((s, c) => s + c.departmentsCount, 0)
  const totalContacts    = stats?.contacts    ?? customers.reduce((s, c) => s + c.contactsCount, 0)
  const totalOpenVac     = stats?.open_vacancies ?? customers.reduce((s, c) => s + c.openVacanciesCount, 0)
  const totalActive      = stats?.active_matches ?? customers.reduce((s, c) => s + c.activeMatchesCount, 0)
  const noContactCount   = stats?.without_contact ?? customers.filter(c => c.contactsCount === 0).length

  const insightDonuts: DonutSpec[] = [
    { key: 'status', title: t('insights.statusTitle'), data: statusData, onPick: d => pickOne(setSelectedStatus)(pickKey(d)),
      active: selectedStatus.length > 0, onClear: () => setSelectedStatus([]) },
    { key: 'am', title: t('insights.amTitle'), data: ownerData, onPick: d => pickOne(setSelectedOwner)(pickKey(d)),
      active: selectedOwner.length > 0, onClear: () => setSelectedOwner([]) },
  ]
  const insightKpis: KpiSpec[] = [
    { key: 'locations',   label: t('insights.locations'),     value: totalLocations,   sub: t('insights.locationsSub'),     color: 'var(--color-secondary)' },
    { key: 'departments', label: t('insights.departments'),   value: totalDepartments, sub: t('insights.departmentsSub'),   color: '#8B5CF6' },
    { key: 'contacts',    label: t('insights.contacts'),      value: totalContacts,    sub: t('insights.contactsSub'),      color: 'var(--color-primary)' },
    { key: 'openVac',     label: t('insights.openVacancies'), value: totalOpenVac,     sub: t('insights.openVacanciesSub'), color: 'var(--color-warning)' },
    { key: 'active',      label: t('insights.activeMatches'), value: totalActive,      sub: t('insights.activeMatchesSub'), color: 'var(--color-success)' },
    { key: 'noContact',   label: t('insights.noContact'),     value: noContactCount,   sub: t('insights.noContactSub'),     color: 'var(--color-danger)' },
  ]

  // ── Drawer open: light row first, then fetch the full detail (ref-guarded) ──
  const selectedIdRef = useRef<Id | null>(null)
  const closeDrawer = () => { selectedIdRef.current = null; setSelected(null); setDetail(null); setDrawerExpanded(false) }
  const selectCustomer = (c: Customer) => {
    if (selected?.id === c.id) { closeDrawer(); return }
    selectedIdRef.current = c.id ?? null
    setSelected(c); setDetail(null); setDrawerExpanded(false)
    api.get(`/customers/${c.id}`)
      .then(r => { if (selectedIdRef.current === c.id) setDetail(mapCustomer(r.data?.data ?? r.data)) })
      .catch(() => {})
  }

  // Optimistic update of one customer (table + open drawer stay in sync), then PATCH.
  const updateCustomer = (id: Id | undefined, patch: Record<string, unknown>) => {
    setCustomers(prev => prev.map(c => c.id === id ? ({ ...c, ...patch } as Customer) : c))
    setSelected(prev => (prev && prev.id === id ? ({ ...prev, ...patch } as Customer) : prev))
    setDetail(prev   => (prev && prev.id === id ? ({ ...prev, ...patch } as Customer) : prev))

    const map: Record<string, string> = {
      name: 'name', debtorNumber: 'debtor_number', city: 'city', industry: 'industry',
      status: 'status', ownerId: 'owner_id', website: 'website', employeeCount: 'employee_count',
      toneOfVoice: 'tone_of_voice', description: 'description', recruitmentProblems: 'recruitment_problems',
      privacyPolicyUrl: 'privacy_policy_url', hideCompanyName: 'hide_company_name', hasCareerPage: 'has_career_page',
      showInVacancies: 'show_in_my_vacancies', excludeFromSourcing: 'exclude_from_sourcing', tags: 'tags',
    }
    const body: Record<string, unknown> = {}
    Object.keys(patch).forEach(k => { if (map[k]) body[map[k]] = patch[k] })
    if (Object.keys(body).length) api.patch(`/customers/${id}`, body).catch(() => {})
  }

  // ── Create + sub-entity add (optimistic + best-effort POST) ──
  const handleCreate = (form: { name: string; debtorNumber: string; status: string; ownerId: string; industry: string; city: string }) => {
    const owner = users.find(u => String(u.id) === form.ownerId)
    const optimistic = mapCustomer({
      id: `new-${Date.now()}`, name: form.name, debtor_number: form.debtorNumber, status: form.status,
      city: form.city, industry: form.industry,
      owner: owner ? { id: owner.id, name: owner.name } : undefined,
    } as ApiCustomer)
    setCustomers(prev => [optimistic, ...prev]); setTotal(tt => tt + 1); setAddOpen(false)
    api.post('/customers', {
      name: form.name, debtor_number: form.debtorNumber, status: form.status,
      city: form.city, industry: form.industry, owner_id: form.ownerId,
    }).then(r => { const c = mapCustomer(r.data?.data ?? r.data); setCustomers(prev => prev.map(x => x.id === optimistic.id ? c : x)) }).catch(() => {})
  }

  const addSub = (cust: Customer) => (type: string, data: Record<string, unknown>, endpoint: string, shape: Record<string, unknown>) => {
    const cu = cust as unknown as Record<string, unknown>
    const tmp = { id: `tmp-${Date.now()}`, ...shape }
    updateCustomer(cust.id, {
      [type]: [...((cu[type] as unknown[]) ?? []), tmp],
      [`${type}Count`]: ((cu[`${type}Count`] as number) ?? 0) + 1,
    })
    api.post(`/customers/${cust.id}/${endpoint}`, data).catch(() => {})
    setSubAdd(null)
  }
  const onCreateLocation   = (cust: Customer) => (d: { name: string; city: string }) => addSub(cust)('locations',   { name: d.name, city: d.city }, 'locations',   { name: d.name, city: d.city, departments: [], contacts: [] })
  const onCreateDepartment = (cust: Customer) => (d: { name: string; locationId: Id }) => addSub(cust)('departments', { name: d.name, location_id: d.locationId }, 'departments', { name: d.name, locationId: d.locationId, locationName: (cust.locations ?? []).find(l => String(l.id) === String(d.locationId))?.name ?? '', contacts: [] })
  const onCreateContact    = (cust: Customer) => (d: { name: string; role: string; email: string }) => addSub(cust)('contacts',    { name: d.name, function: d.role, email: d.email }, 'contacts', { name: d.name, role: d.role, email: d.email })

  // Add a note to a customer (optimistic + POST).
  const addNote = (id: Id | undefined, payload: NotePayload) => {
    const note = { id: `tmp-${Date.now()}`, type: payload.type, title: payload.title, text: payload.body, ago: '' }
    setDetail(prev => (prev && prev.id === id ? ({ ...prev, notes: [note, ...(prev.notes ?? [])] } as Customer) : prev))
    api.post(`/customers/${id}/notes`, { type: payload.type, title: payload.title, text: payload.body }).catch(() => {})
  }

  // ── Bulk selection + mutations ──
  const toggleRow = (id: Id) => setSelectedIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const toggleAll = (ids: Id[], allSelected: boolean) => setSelectedIds(prev => { const n = new Set(prev); ids.forEach(id => { if (allSelected) n.delete(id); else n.add(id) }); return n })
  const notify = (type: string, text: string) => { setActionMsg({ type, text }); if (msgTimer.current) clearTimeout(msgTimer.current); msgTimer.current = setTimeout(() => setActionMsg(null), 4000) }
  useEffect(() => () => { if (msgTimer.current) clearTimeout(msgTimer.current) }, [])

  const subsetOf = (obj: Record<string, unknown>, keys: string[]): Record<string, unknown> => keys.reduce<Record<string, unknown>>((a, k) => { a[k] = obj[k]; return a }, {})
  // Generic optimistic bulk field mutation (apply → reconcile on `updated` → revert).
  const bulkMutate = ({ url, body, patch, keys, onSuccess }: { url: string; body: Record<string, unknown>; patch: Record<string, unknown>; keys: string[]; onSuccess: (n: number) => void }) => {
    const ids = [...selectedIds]
    if (!ids.length) return
    const snap = new Map(customers.filter(c => c.id != null && ids.includes(c.id)).map(c => [c.id, subsetOf(c as unknown as Record<string, unknown>, keys)]))
    setCustomers(prev => prev.map(c => ids.includes(c.id!) ? ({ ...c, ...patch } as Customer) : c))
    api.post(url, { customer_ids: ids, ...body })
      .then(res => { const updated = Array.isArray(res.data?.updated) ? new Set(res.data.updated) : null
        if (updated) setCustomers(prev => prev.map(c => (ids.includes(c.id!) && !updated.has(c.id)) ? ({ ...c, ...snap.get(c.id) } as Customer) : c))
        onSuccess(updated ? updated.size : ids.length) })
      .catch(() => { setCustomers(prev => prev.map(c => ids.includes(c.id!) ? ({ ...c, ...snap.get(c.id) } as Customer) : c)); notify('error', t('bulk.mutateError')) })
    setSelectedIds(new Set())
  }
  const bulkSetOwner  = (user: AppUser)   => bulkMutate({ url: '/customers/bulk/owner', body: { owner_id: user.id },
    patch: { owner: user.name, ownerId: user.id, ownerInitials: initialsOf(user.name), ownerColor: user.avatar_color ?? null },
    keys: ['owner', 'ownerId', 'ownerInitials', 'ownerColor'], onSuccess: n => notify('success', t('bulk.ownerChanged', { name: user.name, count: n })) })
  const bulkSetStatus = (status: string) => bulkMutate({ url: '/customers/bulk/status', body: { status },
    patch: { status, statusLabel: statusMeta(status).label, statusColor: statusMeta(status).color }, keys: ['status', 'statusLabel', 'statusColor'],
    onSuccess: n => notify('success', t('bulk.statusChanged', { value: statusMeta(status).label, count: n })) })

  const selectedTags = useMemo(() => {
    const set = new Set<string>()
    customers.forEach(c => { if (c.id != null && selectedIds.has(c.id)) (c.tags as string[] ?? []).forEach(tg => set.add(tg)) })
    return [...set]
  }, [customers, selectedIds])

  const bulkAddTag = (tag: string) => {
    const t2 = (tag ?? '').trim(); if (!t2) return
    const ids = [...selectedIds]
    const changed = customers.filter(c => ids.includes(c.id!) && !(c.tags ?? []).includes(t2)).map(c => c.id)
    setCustomers(prev => prev.map(c => changed.includes(c.id) ? { ...c, tags: [...(c.tags ?? []), t2] } : c))
    api.post('/customers/bulk/tags', { customer_ids: ids, tag: t2 })
      .then(() => notify('success', t('bulk.tagAdded', { tag: t2, count: changed.length })))
      .catch(() => { setCustomers(prev => prev.map(c => changed.includes(c.id) ? { ...c, tags: (c.tags ?? []).filter(x => x !== t2) } : c)); notify('error', t('bulk.mutateError')) })
    setSelectedIds(new Set())
  }
  const bulkRemoveTag = (tag: string) => {
    const ids = [...selectedIds]
    const changed = customers.filter(c => ids.includes(c.id!) && (c.tags ?? []).includes(tag)).map(c => c.id)
    setCustomers(prev => prev.map(c => changed.includes(c.id) ? { ...c, tags: (c.tags ?? []).filter(x => x !== tag) } : c))
    api.post('/customers/bulk/tags/remove', { customer_ids: ids, tag })
      .then(() => notify('success', t('bulk.tagRemoved', { tag, count: changed.length })))
      .catch(() => { setCustomers(prev => prev.map(c => changed.includes(c.id) ? { ...c, tags: [...(c.tags ?? []), tag] } : c)); notify('error', t('bulk.mutateError')) })
    setSelectedIds(new Set())
  }
  const bulkAddNote = (text: string) => {
    const ids = [...selectedIds]; if (!ids.length || !text.trim()) return
    api.post('/customers/bulk/notes', { customer_ids: ids, text: text.trim() })
      .then(res => notify('success', t('bulk.noteAdded', { count: Array.isArray(res.data?.updated) ? res.data.updated.length : ids.length })))
      .catch(() => notify('error', t('bulk.mutateError')))
    setSelectedIds(new Set())
  }
  const bulkArchive = () => {
    const ids = [...selectedIds]; if (!ids.length) return
    if (!window.confirm(t('bulk.archiveConfirm', { count: ids.length }))) return
    api.post('/customers/bulk/archive', { customer_ids: ids })
      .then(res => { const archived: Id[] = Array.isArray(res.data?.archived) ? res.data.archived : ids; const set = new Set(archived)
        setCustomers(prev => prev.filter(c => !set.has(c.id!))); setTotal(tt => Math.max(0, tt - archived.length))
        notify('success', t('bulk.archived', { count: archived.length })) })
      .catch(() => notify('error', t('bulk.archiveError')))
    setSelectedIds(new Set())
  }

  return (
    <>
      {addOpen && <AddCustomerModal onClose={() => setAddOpen(false)} onCreate={handleCreate} users={users} statuses={statuses} />}
      <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          <InsightsRow donuts={insightDonuts} kpis={insightKpis} clearTitle={t('insights.clearFilter')} />

          {actionMsg && (
            <div role="status" aria-live="polite" style={{ margin: '0 24px 10px', display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 12px', borderRadius: 8, fontSize: 12.5,
              background: actionMsg.type === 'error' ? 'var(--color-danger-bg)' : 'var(--color-success-bg)',
              color: actionMsg.type === 'error' ? 'var(--color-danger)' : 'var(--color-success)',
              border: `1px solid ${actionMsg.type === 'error' ? 'var(--color-danger)' : 'var(--color-success)'}` }}>
              {actionMsg.type === 'error' ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
              <span style={{ flex: 1 }}>{actionMsg.text}</span>
              <button onClick={() => setActionMsg(null)} style={{ display: 'flex', border: 'none', background: 'none', cursor: 'pointer', color: 'inherit', padding: 2 }}><X size={13} /></button>
            </div>
          )}

          <div style={{ padding: '0 24px 12px', display: 'flex', gap: 10, alignItems: 'center', minHeight: 36, flexShrink: 0 }}>
            {selectedIds.size > 0 ? (
              <CustomersBulkBar count={selectedIds.size} onClear={() => setSelectedIds(new Set())}
                onSetOwner={bulkSetOwner} onSetStatus={bulkSetStatus} onAddTag={bulkAddTag}
                onRemoveTag={bulkRemoveTag} onAddNote={bulkAddNote} onArchive={bulkArchive}
                canArchive={hasPermission('customers.delete')}
                users={users} statuses={statuses} selectedTags={selectedTags} />
            ) : (
              <button onClick={() => setAddOpen(true)} style={{ marginLeft: 'auto', padding: '7px 14px', fontSize: 12, fontWeight: 500,
                background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
                + {t('page.add')}
              </button>
            )}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 16px' }}>
            {error && (
              <div className="mb-3 rounded-lg px-3 py-2.5 text-sm text-red-600 bg-red-50 border border-red-200">{error}</div>
            )}
            <CustomersTable rows={customers} loading={loading} selectedId={selected?.id} onSelect={selectCustomer}
              statusMeta={statusMeta} selectable selectedIds={selectedIds} onToggleRow={toggleRow} onToggleAll={toggleAll}
              stickyHeader />
          </div>

          <PaginationBar page={page} totalPages={lastPage} totalRows={total} pageSize={pageSize}
            onPageChange={setPage} onPageSizeChange={s => { setPageSize(s); setPage(1) }} />
        </div>

        <CustomerDrawer
          key={selected ? `${selected.id}-${detail ? 'full' : 'lite'}` : 'none'}
          customer={detail ?? selected}
          onClose={closeDrawer}
          expanded={drawerExpanded}
          onToggleExpand={() => setDrawerExpanded(v => !v)}
          onUpdate={updateCustomer}
          onAddSub={(type, customer) => setSubAdd({ type, customer })}
          onAddNote={addNote}
          users={users}
          statuses={statuses}
        />
      </div>

      {subAdd?.type === 'locations' && (
        <AddLocationModal customerName={subAdd.customer.name} onClose={() => setSubAdd(null)} onCreate={onCreateLocation(subAdd.customer)} />
      )}
      {subAdd?.type === 'departments' && (
        <AddDepartmentModal customerName={subAdd.customer.name} locations={(subAdd.customer.locations ?? []).map(l => ({ id: l.id ?? '', name: l.name }))} onClose={() => setSubAdd(null)} onCreate={onCreateDepartment(subAdd.customer)} />
      )}
      {subAdd?.type === 'contacts' && (
        <AddContactPersonModal customerName={subAdd.customer.name} onClose={() => setSubAdd(null)} onCreate={onCreateContact(subAdd.customer)} />
      )}
    </>
  )
}
