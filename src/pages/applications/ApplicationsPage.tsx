import { useState, useEffect, useMemo, useRef } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import { LayoutList, Kanban, Plus } from 'lucide-react'
import api, { unwrapList } from '../../lib/api'
import { notifyError } from '@/lib/notify'
import { isAbortError } from '../../lib/mocks'
import { useRightPanel } from '../../context/RightPanelContext'
import { useLookups } from '../../context/LookupsContext'
import { useAuth } from '../../context/AuthContext'
import InsightsRow from '../../components/insights/InsightsRow'
import type { DonutSpec, KpiSpec } from '../../components/insights/InsightsRow'
import ApplicationsTable from './ApplicationsTable'
import ApplicationsBoard from './ApplicationsBoard'
import type { BoardPhase } from './ApplicationsBoard'
import ApplicationDrawer from './ApplicationDrawer'
import AddApplicationModal from './AddApplicationModal'
import PaginationBar from '../../components/ui/PaginationBar'
import { mapApplication, mapApplicationDetail } from './data/mapApplication'
import { bucketOfPhase } from './data/applicationsShared'
import type { Application, ApplicationDetail, ApiApplication } from '../../types/application'
import type { RejectPayload } from './drawer/RejectionBlock'
import type { Criterion } from './drawer/MatchScoreBlock'
import type { Id } from '../../types/common'

interface AppStats { by_phase?: Array<{ phase_key?: string; key?: string; value?: string; count?: number }>; by_bucket?: Record<string, number> }
interface Aggregate { name: string; key: string; color?: string; value: number }

const BUCKETS = ['active', 'matched', 'rejected']

// Donut click → set exactly one filter value (or clear when clicking it again).
const pickOne = (set: Dispatch<SetStateAction<string[]>>) => (d: unknown) => {
  const o = d as { key?: string; name?: string; payload?: { key?: string } } | null | undefined
  const v = o?.key ?? o?.payload?.key ?? o?.name
  if (v != null) set(p => (p.length === 1 && p[0] === v) ? [] : [v])
}
// Right-panel multi-toggle for a filter dimension.
const tog = (set: Dispatch<SetStateAction<string[]>>) => (v: string) => set(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v])

export default function ApplicationsPage() {
  const { t } = useTranslation('applications')
  const auth = useAuth()
  const user = auth?.user as { default_per_page?: number } | null | undefined
  const { registerFilters, unregisterFilters } = useRightPanel()
  // Funnel phases come from the tenant lookup (Settings → Funnel stages), never hardcoded.
  const { funnelTypes, funnelMeta } = useLookups()

  const [applications, setApplications] = useState<Application[]>([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState(false)
  const [view,         setView]         = useState('table')   // 'table' | 'board'
  const [bucket,       setBucket]       = useState('active')
  const [page,         setPage]         = useState(1)
  const [pageSize,     setPageSize]     = useState(() => user?.default_per_page ?? 50)
  const [selected,     setSelected]     = useState<ApplicationDetail | null>(null)
  const [expanded,     setExpanded]     = useState(false)
  const [selectedPhase,  setSelectedPhase]  = useState<string[]>([])
  const [selectedOwner,  setSelectedOwner]  = useState<string[]>([])
  const [selectedSource, setSelectedSource] = useState<string[]>([])
  const [selectedVac,    setSelectedVac]    = useState<string[]>([])
  const [addOpen,        setAddOpen]        = useState(false)
  const [stats,          setStats]          = useState<AppStats | null>(null)

  // Board columns = the funnel lookup, normalised to { key, label, color }.
  const phases = useMemo<BoardPhase[]>(() => funnelTypes.map(f => ({ key: f.value, label: f.label, color: f.color })), [funnelTypes])

  // Resolve an application's phase label/colour from the lookup (de-hardcoded).
  const decorate = <T extends Application>(a: T): T => { const m = funnelMeta(a.phaseKey); return { ...a, phaseLabel: m.label, phaseColor: m.color } }

  // Load applications. A 404 means the endpoint isn't built yet → treat as empty.
  useEffect(() => {
    const ctrl = new AbortController()
    setLoading(true); setError(false)
    api.get('/applications', { signal: ctrl.signal })
      .then(res => setApplications(unwrapList<ApiApplication>(res).rows.map(mapApplication)))
      .catch(err => {
        if (isAbortError(err)) return
        if (err?.response?.status && err.response.status !== 404) setError(true)
      })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false) })
    return () => ctrl.abort()
  }, [])

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
    const m: Record<string, Aggregate> = {}
    applications.forEach(a => { const n = a.owner?.name; if (n) (m[n] ??= { name: n, key: n, color: a.owner?.color ?? undefined, value: 0 }).value++ })
    return Object.values(m)
  }, [applications])
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
  useEffect(() => { setPage(1) }, [bucket, selectedPhase, selectedOwner, selectedSource, selectedVac])

  // The visible rows: bucket + phase/owner/source/vacancy filters, decorated.
  const filteredAll = useMemo(() => {
    return applications.filter(a => {
      if (a.bucket !== bucket) return false
      if (selectedPhase.length  && !selectedPhase.includes(a.phaseKey))         return false
      if (selectedOwner.length  && !selectedOwner.includes(a.owner?.name))      return false
      if (selectedSource.length && !selectedSource.includes(a.source))          return false
      if (selectedVac.length    && !selectedVac.includes(String(a.vacancyId)))  return false
      return true
    }).map(decorate)
  }, [applications, bucket, selectedPhase, selectedOwner, selectedSource, selectedVac, funnelTypes]) // eslint-disable-line react-hooks/exhaustive-deps

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

  // Kanban move: set the new phase + bucket; label/colour re-resolve from the lookup.
  const handleMove = (id: Id, phaseKey: string) => {
    setApplications(prev => prev.map(a => a.id === id ? { ...a, phaseKey, bucket: bucketOfPhase(phaseKey) } : a))
    api.patch(`/applications/${id}`, { phase_key: phaseKey }).catch(() => notifyError(t('common:actionFailed')))
  }

  // Reject an application: move it to the rejected phase/bucket optimistically.
  const handleReject = (id: Id | undefined, payload: RejectPayload) => {
    const patch = { phaseKey: 'rejected', bucket: 'rejected',
      rejection: { reason_label: payload.reason_label, note: payload.note, channel: payload.channel } }
    setApplications(prev => prev.map(a => a.id === id ? ({ ...a, ...patch } as Application) : a))
    setSelected(prev => (prev && prev.id === id ? decorate({ ...prev, ...patch } as ApplicationDetail) : prev))
    api.post(`/applications/${id}/reject`, {
      reason_id: payload.reason_id, note: payload.note, channel: payload.channel, message: payload.message,
    }).catch(() => {})
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

  // ── Insights strip: 3 donuts (filterable) + 4 KPI cards, equal footprint ──
  const insightDonuts: DonutSpec[] = [
    { key: 'phase',  title: t('insights.phase'),  data: phaseData,  onPick: pickOne(setSelectedPhase),  active: selectedPhase.length > 0,  onClear: () => setSelectedPhase([]) },
    { key: 'owner',  title: t('insights.owner'),  data: ownerData,  onPick: pickOne(setSelectedOwner),  active: selectedOwner.length > 0,  onClear: () => setSelectedOwner([]) },
    { key: 'source', title: t('insights.source'), data: sourceData, onPick: pickOne(setSelectedSource), active: selectedSource.length > 0, onClear: () => setSelectedSource([]) },
  ]
  const insightKpis: KpiSpec[] = [
    { key: 'totalActive', label: t('kpi.totalActive'), value: bucketCount('active') + bucketCount('matched'), color: 'var(--color-primary)' },
    { key: 'matched',     label: t('kpi.matched'),     value: bucketCount('matched'),  color: 'var(--color-success)' },
    { key: 'rejected',    label: t('kpi.rejected'),    value: bucketCount('rejected'), color: 'var(--color-danger)' },
    { key: 'new',         label: t('kpi.new'),         value: applications.filter(a => a.isNew && a.bucket === 'active').length, color: 'var(--color-warning)' },
  ]

  return (
    <div style={{ display: 'flex', height: '100%', background: 'var(--bg)', overflow: 'hidden' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>

        {/* Insights strip (donuts + KPIs) */}
        <InsightsRow donuts={insightDonuts} kpis={insightKpis} clearTitle={t('insights.clearFilter')} />

        {/* Tab bar — add + buckets + view toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between',
          padding: '8px 24px', background: 'var(--bg)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <button onClick={() => setAddOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 5,
            padding: '6px 14px', fontSize: 13, fontWeight: 500, background: 'var(--color-primary)', color: '#fff',
            border: 'none', borderRadius: 8, cursor: 'pointer' }}>
            <Plus size={14} /> {t('add.button')}
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {BUCKETS.map(b => (
            <button key={b} onClick={() => setBucket(b)} style={{ padding: '5px 14px', fontSize: 13,
              fontWeight: bucket === b ? 600 : 400, borderRadius: 7, cursor: 'pointer',
              background: bucket === b ? 'var(--color-primary)' : 'transparent',
              color: bucket === b ? '#fff' : 'var(--text)',
              border: bucket === b ? 'none' : '1px solid var(--border)' }}>
              {t(`buckets.${b}`)}
            </button>
          ))}
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
            <div style={{ flex: 1, overflow: 'auto', padding: '0 24px 16px' }}>
              <ApplicationsTable rows={filtered} loading={loading} error={error}
                selectedId={selected?.id} onSelect={selectApplication} stickyHeader />
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
      />

      {addOpen && <AddApplicationModal onClose={() => setAddOpen(false)} onCreated={handleCreated} />}
    </div>
  )
}
