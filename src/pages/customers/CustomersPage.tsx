import { useState, useEffect, useMemo, useRef } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, AlertTriangle, X } from 'lucide-react'
import { useRightPanel } from '@/context/RightPanelContext'
import { useAuth } from '@/context/AuthContext'
import { useOpenFromIntent } from '@/context/NavigationContext'
import ErrorBanner from '@/components/ui/ErrorBanner'
import { useUsers } from '@/lib/queries'
import { useCustomerLookups } from '@/lib/useCustomerLookups'
import InsightsRow from '@/components/insights/InsightsRow'
import type { DonutSpec, KpiSpec } from '@/components/insights/InsightsRow'
import PaginationBar from '@/components/ui/PaginationBar'
import HeaderSearch from '@/components/ui/HeaderSearch'
import CustomersTable from './CustomersTable'
import CustomersBulkBar from './CustomersBulkBar'
import CustomerDrawer from './CustomerDrawer'
import AddCustomerModal from './AddCustomerModal'
import AddLocationModal from './AddLocationModal'
import AddDepartmentModal from './AddDepartmentModal'
import AddContactPersonModal from './AddContactPersonModal'
import { useCustomersData } from './hooks/useCustomersData'
import { useCustomerRecord } from './hooks/useCustomerRecord'
import { useCustomerBulkActions } from './hooks/useCustomerBulkActions'
import type { Id } from '@/types/common'

interface AppUser { id: Id; name: string; avatar_color?: string }
interface Opt { value: Id; label: string; count: number }

// Recharts hands the clicked segment both at top level and under `.payload`.
const pickKey = (d: unknown): string | undefined => {
  const o = d as { key?: string; name?: string; payload?: { key?: string } } | null | undefined
  return o?.key ?? o?.payload?.key ?? o?.name
}
const toggleOneValue = (set: Dispatch<SetStateAction<string[]>>, value: string) => set(p => (p.length === 1 && p[0] === value) ? [] : [value])

export default function CustomersPage({ intent }: { intent?: unknown } = {}) {
  const { t } = useTranslation('customers')
  const { registerFilters, unregisterFilters } = useRightPanel()
  const auth = useAuth()
  const hasPermission = auth?.hasPermission ?? (() => false)
  const { data: users = [] } = useUsers() as { data?: AppUser[] }
  const { statuses, statusMeta } = useCustomerLookups()

  // ── UI state ──
  const [page,      setPage]      = useState(1)
  // TODO C-33: use user.default_per_page once the backend accepts per_page > 100 on this endpoint.
  const [pageSize,  setPageSize]  = useState(50)
  const [addOpen,   setAddOpen]   = useState(false)
  // Archived (soft-deleted) view toggle — opts the list into ?include_archived=1.
  const [showArchived, setShowArchived] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<Id>>(() => new Set())
  const [actionMsg, setActionMsg] = useState<{ type: string; text: string } | null>(null)
  const msgTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tableScrollRef = useRef<HTMLDivElement>(null)

  // ── Filter dimensions (server-side) ──
  const [globalSearch,     setGlobalSearch]     = useState('')
  const [selectedStatus,   setSelectedStatus]   = useState<string[]>([])
  const [selectedOwner,    setSelectedOwner]    = useState<string[]>([])
  const [selectedCity,     setSelectedCity]     = useState<string[]>([])
  const [selectedIndustry, setSelectedIndustry] = useState<string[]>([])

  const filterParams = useMemo(() => {
    const p: Record<string, unknown> = {}
    if (globalSearch.trim())     p.search   = globalSearch.trim()
    if (selectedStatus.length)   p.status   = selectedStatus
    if (selectedOwner.length)    p.owner_id = selectedOwner
    if (selectedCity.length)     p.city     = selectedCity
    if (selectedIndustry.length) p.industry = selectedIndustry
    if (showArchived)            p.include_archived = 1
    return p
  }, [globalSearch, selectedStatus, selectedOwner, selectedCity, selectedIndustry, showArchived])
  const filterKey = JSON.stringify(filterParams)

  useEffect(() => { setPage(1) }, [filterKey])
  useEffect(() => { setSelectedIds(new Set()) }, [filterKey, page, pageSize])

  // Transient feedback for bulk mutations, auto-dismissed.
  const notify = (type: string, text: string) => { setActionMsg({ type, text }); if (msgTimer.current) clearTimeout(msgTimer.current); msgTimer.current = setTimeout(() => setActionMsg(null), 4000) }
  useEffect(() => () => { if (msgTimer.current) clearTimeout(msgTimer.current) }, [])

  // ── Data layer (§3): list/stats · record/drawer · bulk actions ──
  const { customers, setCustomers, loading, error, total, setTotal, lastPage, stats } =
    useCustomersData({ filterParams, page, pageSize, t })
  const {
    selected, detail, drawerExpanded, setDrawerExpanded, subAdd, setSubAdd,
    closeDrawer, selectCustomer, updateCustomer, handleCreate,
    onCreateLocation, onCreateDepartment, onCreateContact, addNote,
  } = useCustomerRecord({ setCustomers, setTotal, users, t })
  const { toggleRow, toggleAll, bulkSetOwner, bulkSetStatus, bulkAddTag, bulkRemoveTag, bulkAddNote, bulkArchive, selectedTags } =
    useCustomerBulkActions({ customers, setCustomers, setTotal, selectedIds, setSelectedIds, notify, statusMeta, t })

  // Open a customer drawer when arriving via a cross-entity link (intent).
  useOpenFromIntent(intent, (id) => selectCustomer({ id } as Parameters<typeof selectCustomer>[0]))

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
    { key: 'status',   type: 'search-select', category: catGeneral, label: t('filters.status'),         selected: selectedStatus,   options: statusOptions,   onToggle: tog(setSelectedStatus) },
    { key: 'industry', type: 'search-select', category: catGeneral, label: t('filters.industry'),       selected: selectedIndustry, options: industryOptions, onToggle: tog(setSelectedIndustry) },
    { key: 'city',     type: 'search-select', category: catGeneral, label: t('filters.city'),           selected: selectedCity,     options: cityOptions,     onToggle: tog(setSelectedCity) },
    { key: 'owner',    type: 'search-select', category: catOrg,     label: t('filters.accountManager'), selected: selectedOwner,    options: ownerOptions,    onToggle: tog(setSelectedOwner) },
  ], [t, catGeneral, catOrg, selectedStatus, selectedIndustry, selectedCity, selectedOwner, statusOptions, industryOptions, cityOptions, ownerOptions])

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

  return (
    <>
      {addOpen && <AddCustomerModal onClose={() => setAddOpen(false)} onCreate={form => { setAddOpen(false); handleCreate(form) }} users={users} statuses={statuses} />}
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
              <button onClick={() => setActionMsg(null)} aria-label={t('common:close')} style={{ display: 'flex', border: 'none', background: 'none', cursor: 'pointer', color: 'inherit', padding: 2 }}><X size={13} /></button>
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
              <>
                {/* Add on the left (like Applications/Candidates) */}
                <button onClick={() => setAddOpen(true)} style={{ padding: '7px 14px', fontSize: 12, fontWeight: 500,
                  background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
                  + {t('page.add')}
                </button>
                {/* Shared header search (T10) — debounced, drives the same server-side ?search=. */}
                <HeaderSearch onSearch={setGlobalSearch} defaultValue={globalSearch}
                  placeholder={t('page.searchPlaceholder')} width={300} />
                {/* Archived (soft-deleted) quick-view on the right */}
                <button onClick={() => setShowArchived(v => !v)} title={t('page.archivedView')}
                  style={{ marginLeft: 'auto', padding: '6px 12px', fontSize: 12, fontWeight: showArchived ? 600 : 400,
                    borderRadius: 8, cursor: 'pointer', background: showArchived ? 'var(--color-primary)' : 'transparent',
                    color: showArchived ? '#fff' : 'var(--text-muted)', border: showArchived ? 'none' : '1px solid var(--border)' }}>
                  {t('page.archivedView')}
                </button>
              </>
            )}
          </div>

          <div ref={tableScrollRef} style={{ flex: 1, overflowY: 'auto', padding: '0 24px 16px' }}>
            {error && (
              <ErrorBanner style={{ marginBottom: 12 }}>{error}</ErrorBanner>
            )}
            <CustomersTable rows={customers.filter(c => (showArchived ? c.archived : !c.archived))} loading={loading} selectedId={selected?.id} onSelect={selectCustomer}
              statusMeta={statusMeta} selectable selectedIds={selectedIds} onToggleRow={toggleRow} onToggleAll={toggleAll}
              stickyHeader scrollParentRef={tableScrollRef} />
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
