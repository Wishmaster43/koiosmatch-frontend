import { useState, useEffect, useMemo, useRef } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import { LayoutList, Kanban, Plus, Archive } from 'lucide-react'
import api, { unwrapList } from '@/lib/api'
import { notifyError, notifySuccess } from '@/lib/notify'
import { isAbortError } from '@/lib/mocks'
import { useRightPanel } from '@/context/RightPanelContext'
import { useLookups } from '@/context/LookupsContext'
import { useAuth } from '@/context/AuthContext'
import { useUsers } from '@/lib/queries'
import { useOpenFromIntent } from '@/context/NavigationContext'
import { useDrawerUrl } from '@/hooks/useDrawerUrl'
import { usePageMemory } from '@/lib/usePageMemory'
import { useApplicationFilters, OWNER_NONE } from './hooks/useApplicationFilters'
import InsightsRow from '@/components/insights/InsightsRow'
import type { DonutSpec, KpiSpec } from '@/components/insights/InsightsRow'
import ApplicationsTable from './ApplicationsTable'
import ApplicationsBoard from './ApplicationsBoard'
import type { BoardPhase } from './ApplicationsBoard'
import ApplicationDrawer from './ApplicationDrawer'
import ApplicationsBulkBar from './ApplicationsBulkBar'
import AddApplicationModal from './AddApplicationModal'
import PaginationBar from '@/components/ui/PaginationBar'
import HeaderSearch from '@/components/ui/HeaderSearch'
import ClearFiltersButton from '@/components/ui/ClearFiltersButton'
import QuickViewToggle from '@/components/ui/QuickViewToggle'
import { mapApplication, mapApplicationDetail } from './data/mapApplication'
import { bucketOfPhase } from './data/applicationsShared'
import type { Application, ApplicationDetail, ApiApplication } from '@/types/application'
import type { RejectPayload } from './drawer/RejectionBlock'
import type { Criterion } from './drawer/MatchScoreBlock'
import type { Id } from '@/types/common'

interface AppStats { by_phase?: Array<{ phase_key?: string; key?: string; value?: string; count?: number }>; by_bucket?: Record<string, number> }
interface Aggregate { name: string; key: string; color?: string; value: number }

const BUCKETS = ['active', 'matched', 'rejected']
// Sentinel filter key for rows without an owner (owner_id is nullable).

// Donut click → set exactly one filter value (or clear when clicking it again).
const pickOne = (set: Dispatch<SetStateAction<string[]>>) => (d: unknown) => {
  const o = d as { key?: string; name?: string; payload?: { key?: string } } | null | undefined
  const v = o?.key ?? o?.payload?.key ?? o?.name
  if (v != null) set(p => (p.length === 1 && p[0] === v) ? [] : [v])
}
// Right-panel multi-toggle for a filter dimension.
const tog = (set: Dispatch<SetStateAction<string[]>>) => (v: string) => set(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v])

export default function ApplicationsPage({ intent }: { intent?: unknown } = {}) {
  const { t } = useTranslation('applications')
  const auth = useAuth()
  const user = auth?.user as { default_per_page?: number } | null | undefined
  // Detach/restore are destructive → gate in the UI (backend re-checks the perm).
  const canManage = auth?.hasPermission?.('applications.update') ?? false
  const { registerFilters, unregisterFilters } = useRightPanel()
  // Funnel phases come from the tenant lookup (Settings → Funnel stages), never hardcoded.
  const { funnelTypes, funnelMeta } = useLookups()
  // Tenant users — options for the editable recruiter (owner) picker in the drawer.
  const { data: users = [] } = useUsers() as { data?: Array<{ id: Id; name: string }> }

  const [applications, setApplications] = useState<Application[]>([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState(false)
  const [view,         setView]         = usePageMemory('apps.view', 'table')   // 'table' | 'board'
  const [page,         setPage]         = usePageMemory('apps.page', 1)
  const [pageSize,     setPageSize]     = useState(() => user?.default_per_page ?? 50)
  const [selected,     setSelected]     = useState<ApplicationDetail | null>(null)
  const [expanded,     setExpanded]     = useState(false)
  // KPI-card attention toggle: null | 'new' | 'scored' | 'aiTasks' (one at a time).
  const toggleAttention = (k: string) => setAttention(p => (p === k ? null : k))
  const [addOpen,        setAddOpen]        = useState(false)
  const [stats,          setStats]          = useState<AppStats | null>(null)
  // ALL filter state + the row predicate live in one hook (§0.3 size split).
  const {
    bucket, setBucket, selectedPhase, setSelectedPhase, attention, setAttention,
    selectedOwner, setSelectedOwner, selectedSource, setSelectedSource,
    selectedVac, setSelectedVac, showArchived, setShowArchived, query, setQuery,
    anyFilterActive, clearAllFilters, searchEpoch, matchesFilters,
  } = useApplicationFilters()
  const [selectedIds,    setSelectedIds]    = useState<Set<Id>>(() => new Set())

  // Clear the selection whenever the visible set changes (bucket/filters/paging).
  useEffect(() => { setSelectedIds(new Set()) },
    [bucket, showArchived, page, pageSize, selectedPhase, selectedOwner, selectedSource, selectedVac, query])

  // Row-selection handlers for the table checkboxes + bulk bar.
  const toggleRow = (id: Id) => setSelectedIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const toggleAll = (ids: Id[], allSelected: boolean) => setSelectedIds(prev => {
    const n = new Set(prev); ids.forEach(i => allSelected ? n.delete(i) : n.add(i)); return n })

  // Board columns = the funnel lookup, normalised to { key, label, color }.
  const phases = useMemo<BoardPhase[]>(() => funnelTypes.map(f => ({ key: f.value, label: f.label, color: f.color })), [funnelTypes])

  // Resolve an application's phase label/colour from the lookup (de-hardcoded).
  const decorate = <T extends Application>(a: T): T => { const m = funnelMeta(a.phaseKey); return { ...a, phaseLabel: m.label, phaseColor: m.color } }

  // Load applications. A 404 means the endpoint isn't built yet → treat as empty.
  // Archived view asks the API for detached rows too (`?include_archived=1`).
  useEffect(() => {
    const ctrl = new AbortController()
    setLoading(true); setError(false)
    api.get(showArchived ? '/applications?include_archived=1' : '/applications', { signal: ctrl.signal })
      .then(res => setApplications(unwrapList<ApiApplication>(res).rows.map(mapApplication)))
      .catch(err => {
        if (isAbortError(err)) return
        if (err?.response?.status && err.response.status !== 404) setError(true)
      })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false) })
    return () => ctrl.abort()
  }, [showArchived])

  // KPI totals across the whole set; page-derived fallback when stats aren't live.
  useEffect(() => {
    const ctrl = new AbortController()
    api.get('/applications/stats', { signal: ctrl.signal })
      .then(res => setStats(res.data?.data ?? res.data ?? null))
      .catch(err => { if (!isAbortError(err)) setStats(null) })
    return () => ctrl.abort()
  }, [])

  // Counts prefer the server-wide stats; fall back to counting the loaded page.
  const phaseCount  = (key: string) => { const s = stats?.by_phase?.find(o => (o.phase_key ?? o.key ?? o.value) === key); return s ? (s.count ?? 0) : applications.filter(a => a.phaseKey === key).length }
  const bucketCount = (b: string)   => stats?.by_bucket?.[b] ?? applications.filter(a => a.bucket === b).length

  // ── Donut data (phase / recruiter / source), each with counts ──
  const phaseData = useMemo<Aggregate[]>(() => phases
    .map(p => ({ name: p.label, key: p.key, color: p.color, value: phaseCount(p.key) }))
    .filter(d => d.value > 0)
  , [phases, applications, stats]) // eslint-disable-line react-hooks/exhaustive-deps
  const ownerData = useMemo<Aggregate[]>(() => {
    // owner_id is legitimately nullable (imports, API-created, pre-assignment):
    // unowned rows form an explicit "No owner" slice instead of being dropped.
    const m: Record<string, Aggregate> = {}
    applications.forEach(a => {
      const n = a.owner?.name
      const key = n || OWNER_NONE
      ;(m[key] ??= { name: n || t('insights.noOwner'), key, color: n ? (a.owner?.color ?? undefined) : '#9CA3AF', value: 0 }).value++
    })
    return Object.values(m)
  }, [applications, t])
  const sourceData = useMemo<Aggregate[]>(() => {
    const m: Record<string, Aggregate> = {}
    applications.forEach(a => { const s = a.source; if (s) (m[s] ??= { name: s, key: s, value: 0 }).value++ })
    return Object.values(m)
  }, [applications])

  // Filter option lists (value/label/count) reuse the donut aggregates.
  const vacOptions = useMemo(() => {
    const m: Record<string, { value: string; label: string; count: number }> = {}
    applications.forEach(a => { if (a.vacancyId) { const k = String(a.vacancyId); (m[k] ??= { value: k, label: a.vacancyTitle, count: 0 }).count++ } })
    return Object.values(m)
  }, [applications])
  const asOptions = (data: Aggregate[]) => data.map(d => ({ value: d.key, label: d.name, count: d.value }))

  // Register the right-panel filters (phase + recruiter + source + vacancy).
  const filterGroups = useMemo(() => [
    { key: 'phase',   label: t('insights.phase'),  selected: selectedPhase,  options: asOptions(phaseData),  onToggle: tog(setSelectedPhase) },
    { key: 'owner',   label: t('insights.owner'),  selected: selectedOwner,  options: asOptions(ownerData),  onToggle: tog(setSelectedOwner) },
    { key: 'source',  label: t('insights.source'), selected: selectedSource, options: asOptions(sourceData), onToggle: tog(setSelectedSource) },
    { key: 'vacancy', label: t('cols.vacancy'),    selected: selectedVac,    options: vacOptions,            onToggle: tog(setSelectedVac) },
  ], [t, selectedPhase, selectedOwner, selectedSource, selectedVac, phaseData, ownerData, sourceData, vacOptions])

  useEffect(() => {
    registerFilters('applications-page', filterGroups)
    return () => unregisterFilters('applications-page')
  }, [filterGroups, registerFilters, unregisterFilters])

  // Reset to the first page whenever the bucket or any filter changes.
  useEffect(() => { setPage(1) }, [bucket, attention, selectedPhase, selectedOwner, selectedSource, selectedVac, showArchived, query])

  // The visible rows: the hook predicate (bucket/filters/attention/search) + decorate.
  // BOARD = the whole funnel: the bucket quick-view is a TABLE concept, so the board
  // ignores it — otherwise the Afgewezen column stays empty while the KPI says 4
  // (Danny 13/7). Other filters (search/owner/source/archived) still apply.
  const filteredAll = useMemo(() => applications.filter(a => matchesFilters(a, { ignoreBucket: view === 'board' })).map(decorate),
    [applications, matchesFilters, view, funnelTypes]) // eslint-disable-line react-hooks/exhaustive-deps

  // Clientside pagination slice (the endpoint returns all rows at once).
  const totalRows  = filteredAll.length
  const lastPage   = Math.max(1, Math.ceil(totalRows / pageSize))
  const filtered   = useMemo(() => filteredAll.slice((page - 1) * pageSize, page * pageSize), [filteredAll, page, pageSize])

  // Open an application: show the light row immediately, then fetch the full detail.
  const selectedIdRef = useRef<Id | null>(null)
  const closeDrawer = () => { selectedIdRef.current = null; setSelected(null); setExpanded(false) }
  const selectApplication = (a: Application) => {
    if (selected?.id === a.id) { closeDrawer(); return }
    selectedIdRef.current = a.id ?? null
    setSelected(decorate(a) as ApplicationDetail); setExpanded(false)
    api.get(`/applications/${a.id}`)
      .then(r => { if (selectedIdRef.current === a.id) setSelected(decorate(mapApplicationDetail(r.data?.data ?? r.data))) })
      .catch(() => {})
  }

  // Open an application drawer when arriving via a cross-entity link (intent).
  useOpenFromIntent(intent, (id) => selectApplication({ id } as Application))

  // Mirror the open drawer in the URL (?open=<id>): browser back/forward walks
  // through it and a copied link reopens the same application (NAV-BACK-1;
  // supersedes the old memory-only remember).
  useDrawerUrl({ selectedId: selected?.id, openById: (id) => selectApplication({ id } as Application), close: closeDrawer, intent })

  // Shared clear-all (page memory keeps filters sticky): anything off-default resets.
  // Seed the funnel-stage filter from a dashboard chart click (funnel / funnel-conversion).
  // Mirrors the candidate status/recruiter drill-down: the InsightsRow then shows the active chip.
  useEffect(() => {
    const i = intent as { stage?: string; vacancy?: string } | undefined
    if (i?.stage) setSelectedPhase([i.stage])
    // A vacancy statistics-bar click carries the vacancy too — scope the list to it.
    if (i?.vacancy) setSelectedVac([String(i.vacancy)])
  }, [intent])

  // Kanban move: set the new phase + bucket; label/colour re-resolve from the lookup.
  const handleMove = (id: Id, phaseKey: string) => {
    const before = applications.find(a => a.id === id)
    const newBucket = bucketOfPhase(phaseKey)
    setApplications(prev => prev.map(a => a.id === id ? { ...a, phaseKey, bucket: newBucket } : a))
    setSelected(prev => (prev && prev.id === id ? decorate({ ...prev, phaseKey, bucket: newBucket } as ApplicationDetail) : prev))
    api.patch(`/applications/${id}`, { phase_key: phaseKey })
      .then(() => {
        // Only claim the move AFTER the server accepted it — the old order showed
        // "Verplaatst" and then failed (Danny 2026-07-13).
        if (newBucket !== bucket) notifySuccess(t('board.movedHidden'))
      })
      .catch(err => {
        // Revert the optimistic move and surface the SERVER's reason (a bare
        // "Actie mislukt" hid why the 422 happened).
        if (before) {
          setApplications(prev => prev.map(a => a.id === id ? { ...a, phaseKey: before.phaseKey, bucket: before.bucket } : a))
          setSelected(prev => (prev && prev.id === id ? decorate({ ...prev, phaseKey: before.phaseKey, bucket: before.bucket } as ApplicationDetail) : prev))
        }
        const serverMsg = (err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } })?.response?.data
        const detail = serverMsg?.message ?? Object.values(serverMsg?.errors ?? {})[0]?.[0]
        notifyError(detail || t('common:actionFailed'))
      })
  }

  // Reassign an application's recruiter (owner); optimistic + PATCH owner_id.
  const handleOwner = (id: Id, ownerId: string) => {
    const u = users.find(x => String(x.id) === String(ownerId))
    if (!u) return
    const initials = u.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    const owner = { id: ownerId, name: u.name, initials, color: null }
    setApplications(prev => prev.map(a => a.id === id ? { ...a, owner } : a))
    setSelected(prev => (prev && prev.id === id ? decorate({ ...prev, owner } as ApplicationDetail) : prev))
    api.patch(`/applications/${id}`, { owner_id: ownerId }).catch(() => notifyError(t('common:actionFailed')))
  }

  // Re-link (or unlink, null) an application's vacancy — shared by the Sollicitatie
  // tab's Details block and the Vacature tab. Klant is derived from the picked
  // option so the row/drawer update instantly; the PATCH response then reconciles
  // both fields (the backend is the source of truth). A model guard refuses the
  // change once a Match hangs on the is_match stage (422) — surface ITS message,
  // never a generic one, and revert the optimistic edit.
  const handleLinkVacancy = (id: Id | undefined, vacancyId: Id | null, meta?: { title?: string; client?: string }) => {
    if (id == null) return
    const before = applications.find(a => a.id === id)
    const patch = { vacancyId, vacancyTitle: vacancyId != null ? (meta?.title ?? '') : '', client: vacancyId != null ? (meta?.client ?? '') : '' }
    setApplications(prev => prev.map(a => a.id === id ? { ...a, ...patch } : a))
    setSelected(prev => (prev && prev.id === id ? decorate({ ...prev, ...patch } as ApplicationDetail) : prev))
    api.patch(`/applications/${id}`, { vacancy_id: vacancyId })
      .then(res => {
        const updated = mapApplication(res.data?.data ?? res.data)
        const reconciled = { vacancyId: updated.vacancyId, vacancyTitle: updated.vacancyTitle, client: updated.client }
        setApplications(prev => prev.map(a => a.id === id ? { ...a, ...reconciled } : a))
        setSelected(prev => (prev && prev.id === id ? decorate({ ...prev, ...reconciled } as ApplicationDetail) : prev))
      })
      .catch(err => {
        if (before) {
          const revert = { vacancyId: before.vacancyId, vacancyTitle: before.vacancyTitle, client: before.client }
          setApplications(prev => prev.map(a => a.id === id ? { ...a, ...revert } : a))
          setSelected(prev => (prev && prev.id === id ? decorate({ ...prev, ...revert } as ApplicationDetail) : prev))
        }
        const serverMsg = (err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } })?.response?.data
        const detail = serverMsg?.message ?? Object.values(serverMsg?.errors ?? {})[0]?.[0]
        notifyError(detail || t('common:actionFailed'))
      })
  }

  // Reject an application: move it to the rejected phase/bucket optimistically.
  const handleReject = (id: Id | undefined, payload: RejectPayload) => {
    const patch = { phaseKey: 'rejected', bucket: 'rejected',
      rejection: { reason_label: payload.reason_label, note: payload.note } }
    setApplications(prev => prev.map(a => a.id === id ? ({ ...a, ...patch } as Application) : a))
    setSelected(prev => (prev && prev.id === id ? decorate({ ...prev, ...patch } as ApplicationDetail) : prev))
    // The message (channel + template) is sent by the rejection workflow.
    api.post(`/applications/${id}/reject`, { reason_id: payload.reason_id, note: payload.note }).catch(() => {})
  }

  // A freshly created application: prepend to the list and open its drawer.
  const handleCreated = (app: Application) => {
    setApplications(prev => [app, ...prev])
    setAddOpen(false)
    selectApplication(app)
  }

  // Manual match-score override on an application (per applicant); optimistic + PATCH.
  const handleAdjustScore = (id: Id | undefined, { score, criteria }: { score: number | null; criteria: Criterion[] }) => {
    const patch = { score, matchCriteria: criteria, matchSource: 'manual' }
    setApplications(prev => prev.map(a => a.id === id ? ({ ...a, ...patch } as Application) : a))
    setSelected(prev => (prev && prev.id === id ? decorate({ ...prev, ...patch } as ApplicationDetail) : prev))
    api.patch(`/applications/${id}`, { match_score: score, match_criteria: criteria }).catch(() => notifyError(t('common:actionFailed')))
  }

  // Save the Extra tab's tenant custom fields (§3B); the tab only mounts while the
  // drawer is open, so `selected` is always the record being edited. Optimistic +
  // PATCH, merging the partial patch into the full map so the backend persists it whole.
  const handleUpdateCustomFields = (id: Id | undefined, patch: Record<string, unknown>) => {
    const merged = { ...(selected?.customFields ?? {}), ...patch }
    setSelected(prev => (prev && prev.id === id ? decorate({ ...prev, customFields: merged } as ApplicationDetail) : prev))
    api.patch(`/applications/${id}`, { custom_fields: merged }).catch(() => notifyError(t('common:actionFailed')))
  }

  // Detach (soft-delete) an application: kept server-side, removed from the active
  // list. Optimistic flag; revert + toast on failure. Gated by applications.update.
  const handleDetach = (id: Id | undefined) => {
    if (id == null) return
    const snapshot = applications
    setApplications(prev => prev.map(a => a.id === id ? { ...a, archived: true } : a))
    closeDrawer()
    api.delete(`/applications/${id}`)
      .then(() => notifySuccess(t('detach.done')))
      .catch(() => { setApplications(snapshot); notifyError(t('common:actionFailed')) })
  }

  // Restore a detached application: back to the active list (backend re-sets the
  // candidate to the applicant phase). Optimistic; revert + toast on failure.
  const handleRestore = (id: Id | undefined) => {
    if (id == null) return
    const snapshot = applications
    setApplications(prev => prev.map(a => a.id === id ? { ...a, archived: false } : a))
    closeDrawer()
    api.post(`/applications/${id}/restore`)
      .then(() => notifySuccess(t('restore.done')))
      .catch(() => { setApplications(snapshot); notifyError(t('common:actionFailed')) })
  }

  // Bulk: move every selected application to one funnel phase; optimistic + PATCH each.
  const bulkSetPhase = (phaseKey: string) => {
    const ids = [...selectedIds]
    if (!ids.length) return
    setApplications(prev => prev.map(a => a.id != null && selectedIds.has(a.id as Id) ? { ...a, phaseKey, bucket: bucketOfPhase(phaseKey) } : a))
    setSelectedIds(new Set())
    Promise.allSettled(ids.map(id => api.patch(`/applications/${id}`, { phase_key: phaseKey })))
      .then(() => notifySuccess(t('bulk.done', { count: ids.length })))
  }

  // Bulk: detach (soft-delete) every selected application; optimistic + revert on any failure.
  const bulkDetach = () => {
    const ids = [...selectedIds]
    if (!ids.length) return
    const snapshot = applications
    setApplications(prev => prev.map(a => a.id != null && selectedIds.has(a.id as Id) ? { ...a, archived: true } : a))
    setSelectedIds(new Set())
    Promise.allSettled(ids.map(id => api.delete(`/applications/${id}`))).then(rs => {
      if (rs.some(r => r.status === 'rejected')) { setApplications(snapshot); notifyError(t('common:actionFailed')) }
      else notifySuccess(t('bulk.done', { count: ids.length }))
    })
  }

  // ── Insights strip: 3 donuts (filterable) + 4 KPI cards, equal footprint ──
  // `picked` = the chip label; phase filters store the SLUG, so resolve it to its label.
  const pickedLabel = (data: Aggregate[], v?: string) => (v ? (data.find(d => d.key === v)?.name ?? v) : null)
  const insightDonuts: DonutSpec[] = [
    { key: 'phase',  title: t('insights.phase'),  data: phaseData,  onPick: pickOne(setSelectedPhase),  active: selectedPhase.length > 0,  onClear: () => setSelectedPhase([]),  picked: pickedLabel(phaseData, selectedPhase[0]) },
    { key: 'owner',  title: t('insights.owner'),  data: ownerData,  onPick: pickOne(setSelectedOwner),  active: selectedOwner.length > 0,  onClear: () => setSelectedOwner([]),  picked: pickedLabel(ownerData, selectedOwner[0]) },
    { key: 'source', title: t('insights.source'), data: sourceData, onPick: pickOne(setSelectedSource), active: selectedSource.length > 0, onClear: () => setSelectedSource([]), picked: pickedLabel(sourceData, selectedSource[0]) },
  ]
  // Average match score across non-rejected applications (KPI, "—" when none scored).
  const scored = applications.filter(a => a.bucket !== 'rejected' && typeof a.score === 'number')
  const avgScore = scored.length ? Math.round(scored.reduce((s, a) => s + (a.score as number), 0) / scored.length) + '%' : '—'
  // Active applications that still carry an AI task (attention KPI).
  const aiTaskCount = applications.filter(a => a.task && a.bucket === 'active').length

  // KPI cards — mirror the candidate strip: count + sub-line, click-to-filter where it maps.
  const insightKpis: KpiSpec[] = [
    // TOTAAL ACTIEF spans two buckets — clicking shows BOTH (active + matched), so the
    // list always matches the number on the card (Danny: "waar zijn ze allemaal?").
    { key: 'totalActive', label: t('kpi.totalActive'), value: bucketCount('active') + bucketCount('matched'),
      sub: t('kpi.totalActiveSub'), color: 'var(--color-primary)',
      onClick: () => { clearAllFilters(); setShowArchived(false); setBucket(bucket === 'allActive' ? 'active' : 'allActive'); setAttention(null) },
      active: bucket === 'allActive' },
    { key: 'new', label: t('kpi.new'), value: applications.filter(a => a.isNew && a.bucket === 'active').length,
      sub: t('kpi.newSub'), color: 'var(--color-warning)',
      onClick: () => { setShowArchived(false); setBucket('active'); toggleAttention('new') }, active: attention === 'new' },
    { key: 'matched', label: t('kpi.matched'), value: bucketCount('matched'), sub: t('kpi.matchedSub'),
      color: 'var(--color-success)', onClick: () => { setShowArchived(false); setBucket('matched') }, active: !showArchived && bucket === 'matched' },
    { key: 'rejected', label: t('kpi.rejected'), value: bucketCount('rejected'), sub: t('kpi.rejectedSub'),
      color: 'var(--color-danger)', onClick: () => { setShowArchived(false); setBucket('rejected') }, active: !showArchived && bucket === 'rejected' },
    { key: 'avgScore', label: t('kpi.avgScore'), value: avgScore, sub: t('kpi.avgScoreSub'), color: 'var(--color-secondary)',
      onClick: () => { setShowArchived(false); toggleAttention('scored') }, active: attention === 'scored' },
    { key: 'aiTasks', label: t('kpi.aiTasks'), value: aiTaskCount, sub: t('kpi.aiTasksSub'), color: '#0D9488',
      onClick: () => { setShowArchived(false); setBucket('active'); toggleAttention('aiTasks') }, active: attention === 'aiTasks' },
  ]

  return (
    <div style={{ display: 'flex', height: '100%', background: 'var(--bg)', overflow: 'hidden' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>

        {/* Insights strip (donuts + KPIs) */}
        <InsightsRow donuts={insightDonuts} kpis={insightKpis} clearTitle={t('insights.clearFilter')} />

        {/* Tab bar — add + buckets + view toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between',
          padding: '0 24px 12px', minHeight: 36, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={() => setAddOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 5,
              padding: '6px 14px', fontSize: 13, fontWeight: 500, background: 'var(--color-primary)', color: '#fff',
              border: 'none', borderRadius: 8, cursor: 'pointer' }}>
              <Plus size={14} /> {t('add.button')}
            </button>
            {/* Shared header search (T10) — debounced, client-side text filter. */}
            <HeaderSearch key={searchEpoch} onSearch={setQuery} placeholder={t('page.searchPlaceholder')} width={300} />
            <ClearFiltersButton active={anyFilterActive} onClear={clearAllFilters} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Bucket tabs — soft-tinted active (§4: never a solid fill). */}
          {BUCKETS.map(b => {
            const on = bucket === b && !showArchived
            return (
            <button key={b} onClick={() => { setShowArchived(false); setBucket(b) }} style={{ padding: '5px 14px', fontSize: 13,
              fontWeight: on ? 600 : 400, borderRadius: 7, cursor: 'pointer',
              background: on ? 'color-mix(in srgb, var(--color-primary) 14%, transparent)' : 'transparent',
              color: on ? 'var(--color-primary)' : 'var(--text)',
              border: `1px solid ${on ? 'color-mix(in srgb, var(--color-primary) 45%, transparent)' : 'var(--border)'}` }}>
              {t(`buckets.${b}`)}
            </button>
            )
          })}
          {/* Archived (detached) view — shared quick-view toggle (§4). */}
          <QuickViewToggle active={showArchived} onToggle={() => setShowArchived(v => !v)}
            label={t('archived.toggle')} icon={Archive} />
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={() => setView('table')} title={t('view.table')} aria-label={t('view.table')}
              style={{ padding: 6, borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer',
                background: view === 'table' ? 'var(--color-primary)' : 'var(--surface)',
                color: view === 'table' ? '#fff' : 'var(--text)' }}>
              <LayoutList size={16} />
            </button>
            <button onClick={() => setView('board')} title={t('view.board')} aria-label={t('view.board')}
              style={{ padding: 6, borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer',
                background: view === 'board' ? 'var(--color-primary)' : 'var(--surface)',
                color: view === 'board' ? '#fff' : 'var(--text)' }}>
              <Kanban size={16} />
            </button>
          </div>
          </div>
        </div>

        {/* Content */}
        {view === 'table' ? (
          <>
            {/* Bulk action bar — shown above the table when ≥1 row is selected. */}
            {selectedIds.size > 0 && (
              <div style={{ padding: '8px 24px 0' }}>
                <ApplicationsBulkBar count={selectedIds.size} onClear={() => setSelectedIds(new Set())}
                  onSetPhase={bulkSetPhase} onDetach={bulkDetach} canManage={canManage} phases={funnelTypes} />
              </div>
            )}
            <div style={{ flex: 1, overflow: 'auto', padding: '0 24px 16px' }}>
              <ApplicationsTable rows={filtered} loading={loading} error={error}
                selectedId={selected?.id} onSelect={selectApplication} stickyHeader
                selectable selectedIds={selectedIds} onToggleRow={toggleRow} onToggleAll={toggleAll} />
            </div>
            <PaginationBar page={page} totalPages={lastPage} totalRows={totalRows}
              pageSize={pageSize} onPageChange={setPage}
              onPageSizeChange={n => { setPageSize(n); setPage(1) }} />
          </>
        ) : (
          <ApplicationsBoard rows={filtered} phases={phases} onMove={handleMove}
            selectedId={selected?.id} onSelect={selectApplication} />
        )}
      </div>

      {/* Detail drawer */}
      <ApplicationDrawer
        key={selected?.id ?? 'none'}
        application={selected}
        onClose={closeDrawer}
        expanded={expanded}
        onToggleExpand={() => setExpanded(v => !v)}
        onReject={handleReject}
        onAdjustScore={handleAdjustScore}
        onUpdateCustomFields={handleUpdateCustomFields}
        onPhaseChange={(id, key) => { if (id != null) handleMove(id, key) }}
        onOwnerChange={(id, ownerId) => { if (id != null) handleOwner(id, ownerId) }}
        onLinkVacancy={handleLinkVacancy}
        users={users}
        onDetach={handleDetach}
        onRestore={handleRestore}
        canManage={canManage}
      />

      {addOpen && <AddApplicationModal onClose={() => setAddOpen(false)} onCreated={handleCreated} />}
    </div>
  )
}
