/**
 * CandidatesPage — the candidate list surface (blueprint for every entity).
 * Thin container: owns the UI state (filters, selection, drawer) and composes the
 * data hook (list/stats/locations), the options hook (filter options + donuts +
 * counts) and the bulk-actions hook, then renders the insights row + table +
 * drawer. Heavy logic lives in the hooks under ./hooks and ./data.
 */
import { useState, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, AlertTriangle, X } from 'lucide-react'
import { useRightPanel } from '../../context/RightPanelContext'
import { useAuth } from '../../context/AuthContext'
import { useLookups } from '../../context/LookupsContext'
import { useUsers } from '../../lib/queries'
import api from '../../lib/api'
import CandidateDrawer from './CandidateDrawer'
import AddCandidateModal from './AddCandidateModal'
import CandidatesTable from './CandidatesTable'
import CandidatesBulkBar from './CandidatesBulkBar'
import InsightsRow from '../../components/insights/InsightsRow'
import PaginationBar from '../../components/ui/PaginationBar'
import { mapCandidate } from './data/mapCandidate'
import { toggleOneValue, isStale, isNeverContacted, isNoFollowup, buildCandidatePatch } from './data/candidatesShared'
import { useCandidatesData } from './hooks/useCandidatesData'
import { useCandidateOptions } from './hooks/useCandidateOptions'
import { useCandidateBulkActions } from './hooks/useCandidateBulkActions'

export default function CandidatesPage({ intent } = {}) {
  // Auth/user must come first — pageSize initial value reads user.default_per_page.
  const { hasPermission, user } = useAuth()
  const { t } = useTranslation('candidates')
  const { candidateTypes, funnelTypes, statuses } = useLookups()
  const { data: users = [] } = useUsers()
  const { registerFilters, unregisterFilters } = useRightPanel()

  const [page,           setPage]           = useState(1)
  // Initialise from the user's profile preference (Profile → Records per page).
  const [pageSize,       setPageSize]       = useState(() => user?.default_per_page ?? 50)
  const [selected,       setSelected]       = useState(null)
  const [drawerExpanded, setDrawerExpanded] = useState(false)
  const [addOpen,        setAddOpen]        = useState(false)
  const [detail,         setDetail]         = useState(null)
  const selectedIdRef = useRef(null)

  // Server-side filter dimensions (the API supports these). Owner holds owner_ids.
  const [selectedStatus,   setSelectedStatus]   = useState([])
  const [selectedFunnel,   setSelectedFunnel]   = useState([])
  const [selectedType,     setSelectedType]     = useState([])
  const [selectedOwner,    setSelectedOwner]    = useState([])
  const [selectedGeslacht, setSelectedGeslacht] = useState([])
  const [selectedProvince, setSelectedProvince] = useState([])
  const [selectedTitle,    setSelectedTitle]    = useState([])
  const [selectedLocation, setSelectedLocation] = useState([])
  const [globalSearch,     setGlobalSearch]     = useState('')
  // Aandacht-tile filter: null | 'stale6m' | 'neverContacted' | 'noFollowup' (klik = aan/uit).
  const [attentionFilter,  setAttentionFilter]  = useState(null)
  // Bulk-selectie (checkboxes) — id-set; gewist bij filter/pagina-wissel.
  const [selectedIds,      setSelectedIds]      = useState(() => new Set())
  // Transient feedback for bulk mutations (success/error), auto-dismissed.
  const [actionMsg,        setActionMsg]        = useState(null) // { type, text }
  const msgTimer = useRef(null)

  // Seed filters from a navigation intent (e.g. a dashboard KPI/chart click).
  useEffect(() => {
    if (!intent) return
    if (intent.attention)     setAttentionFilter(intent.attention)
    if (intent.status)        setSelectedStatus([intent.status])
    if (intent.owner != null) setSelectedOwner([intent.owner])
    if (intent.funnel)        setSelectedFunnel([intent.funnel])
    if (intent.location)      setSelectedLocation([intent.location])
  }, [intent])

  const handlePageSizeChange = (newSize) => { setPageSize(newSize); setPage(1) }

  // Server-side filter params (axios serialises arrays as `key[]`). Only the
  // dimensions the API supports; the rest of the right panel is hidden for now.
  const filterParams = useMemo(() => {
    const p = {}
    if (globalSearch.trim())     p.search         = globalSearch.trim()
    if (selectedStatus.length)   p.status         = selectedStatus
    if (selectedFunnel.length)   p.funnel_type    = selectedFunnel
    if (selectedType.length)     p.candidate_type = selectedType
    if (selectedOwner.length)    p.owner_id       = selectedOwner
    if (selectedGeslacht.length) p.gender         = selectedGeslacht
    if (selectedProvince.length) p.province       = selectedProvince
    if (selectedTitle.length)    p.function_title = selectedTitle
    if (selectedLocation.length) p.location_id    = selectedLocation
    return p
  }, [globalSearch, selectedStatus, selectedFunnel, selectedType, selectedOwner, selectedGeslacht, selectedProvince, selectedTitle, selectedLocation])
  const filterKey = JSON.stringify(filterParams)

  // Filters changed → back to page 1. Visible rows change → drop the bulk selection.
  useEffect(() => { setPage(1) }, [filterKey])
  useEffect(() => { setSelectedIds(new Set()) }, [filterKey, page, pageSize])

  // Show a transient success/error message; replaces any previous one.
  const notify = (type, text) => {
    setActionMsg({ type, text })
    if (msgTimer.current) clearTimeout(msgTimer.current)
    msgTimer.current = setTimeout(() => setActionMsg(null), 4000)
  }
  useEffect(() => () => { if (msgTimer.current) clearTimeout(msgTimer.current) }, [])

  // ── Data layer ──
  const { candidates, setCandidates, loading, error, total, setTotal, lastPage, stats, locations } =
    useCandidatesData({ filterParams, page, pageSize, t, setActionMsg })

  // ── Derived options + donut data + attention counts ──
  const {
    statusOptions, funnelOptions, typeOptions, ownerOptions,
    genderOptions, provinceOptions, titleOptions, locationOptions,
    statusData, funnelData, rcData,
    staleCount, neverContactedCount, noFollowupCount, intakeCount, activeConvCount, tasksCount,
  } = useCandidateOptions({ stats, candidates, locations, statuses, funnelTypes, candidateTypes, t })

  const tog = (set) => (v) => set(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v])
  // Klik-op-chart → zet precies één waarde, of wis bij nogmaals klikken (toggle).
  const pickOne = (set) => (v) => { if (v != null) toggleOneValue(set, v) }
  const pickStatus = pickOne(setSelectedStatus)
  const pickFunnel = pickOne(setSelectedFunnel)
  const pickOwner  = pickOne(setSelectedOwner)
  const toggleAttention = (key) => setAttentionFilter(prev => prev === key ? null : key)

  const catLifecycle      = t('filters.categories.lifecycle')
  const catQualifications = t('filters.categories.qualifications')
  const catPerson         = t('filters.categories.person')
  const catOrganisation   = t('filters.categories.organisation')

  // Only the dimensions the API filters server-side.
  const filterGroups = useMemo(() => [
    { key: 'global-search', type: 'global-search', label: t('filters.search'), placeholder: t('page.searchPlaceholder'), value: globalSearch, onChange: setGlobalSearch },
    { key: 'status', type: 'search-select', category: catLifecycle, label: t('filters.status'),        selected: selectedStatus, options: statusOptions, onToggle: tog(setSelectedStatus) },
    { key: 'funnel', type: 'search-select', category: catLifecycle, label: t('filters.funnelType'),    selected: selectedFunnel, options: funnelOptions, onToggle: tog(setSelectedFunnel) },
    { key: 'type',   type: 'search-select', category: catLifecycle, label: t('filters.candidateType'), selected: selectedType,   options: typeOptions,   onToggle: tog(setSelectedType) },
    { key: 'title',  type: 'search-select', category: catQualifications, label: t('filters.function'), selected: selectedTitle, options: titleOptions, onToggle: tog(setSelectedTitle) },
    { key: 'gender',   type: 'search-select', category: catPerson, label: t('filters.gender'),   selected: selectedGeslacht, options: genderOptions,   onToggle: tog(setSelectedGeslacht) },
    { key: 'province', type: 'search-select', category: catPerson, label: t('filters.province'), selected: selectedProvince, options: provinceOptions, onToggle: tog(setSelectedProvince) },
    { key: 'owner',    type: 'search-select', category: catOrganisation, label: t('filters.owner'),  selected: selectedOwner,    options: ownerOptions,    onToggle: tog(setSelectedOwner) },
    { key: 'location', type: 'search-select', category: catOrganisation, label: t('filters.branch'), selected: selectedLocation, options: locationOptions, onToggle: tog(setSelectedLocation) },
  ], [t, catLifecycle, catQualifications, catPerson, catOrganisation, globalSearch,
      selectedStatus, selectedFunnel, selectedType, selectedTitle, selectedGeslacht, selectedProvince, selectedOwner, selectedLocation,
      statusOptions, funnelOptions, typeOptions, titleOptions, genderOptions, provinceOptions, ownerOptions, locationOptions])

  useEffect(() => {
    registerFilters('candidates-page', filterGroups)
    return () => unregisterFilters('candidates-page')
  }, [filterGroups, registerFilters, unregisterFilters])

  // The only client-side refinement left is the attention tile (no server filter yet).
  const filtered = useMemo(() => {
    if (!attentionFilter) return candidates
    const pred = attentionFilter === 'stale6m' ? isStale
               : attentionFilter === 'neverContacted' ? isNeverContacted
               : isNoFollowup
    return candidates.filter(pred)
  }, [candidates, attentionFilter])

  // Open a candidate: hand the light row to the drawer, then fetch the full record.
  const selectCandidate = (c) => {
    selectedIdRef.current = c.id
    setSelected(c); setDetail(null); setDrawerExpanded(false)
    api.get(`/candidates/${c.id}`)
      .then(r => { if (selectedIdRef.current === c.id) setDetail(mapCandidate(r.data?.data ?? r.data)) })
      .catch(() => {})
  }
  const closeDrawer = () => { selectedIdRef.current = null; setSelected(null); setDetail(null); setDrawerExpanded(false) }

  // A freshly created candidate: prepend to the list and open its drawer.
  const handleCreated = (c) => {
    setCandidates(prev => [c, ...prev])
    setTotal(prev => prev + 1)
    setAddOpen(false)
    selectCandidate(c)
  }

  // Header/profile edits in the drawer flow back here: optimistic locally, then PATCH.
  const updateCandidate = (id, patch) => {
    setCandidates(prev => prev.map(x => x.id === id ? { ...x, ...patch } : x))
    setSelected(prev => (prev && prev.id === id ? { ...prev, ...patch } : prev))
    setDetail(prev  => (prev && prev.id === id ? { ...prev, ...patch } : prev))
    const body = buildCandidatePatch(patch)
    if (Object.keys(body).length) api.patch(`/candidates/${id}`, body).catch(() => {})
  }

  // ── Bulk actions ──
  const {
    toggleRow, toggleAll, bulkAddToPool, bulkRemoveFromPool,
    bulkSetOwner, bulkSetStage, bulkSetTypes, selectedTags, bulkRemoveTag, bulkAddNote, bulkArchive,
  } = useCandidateBulkActions({ candidates, setCandidates, setTotal, selectedIds, setSelectedIds, notify, t, funnelTypes, candidateTypes })

  // Recharts hands the clicked segment back at top level AND under `.payload`.
  const pickKey = (d) => d?.key ?? d?.payload?.key ?? d?.name

  // ── One strip: 3 donuts + KPI cards, all equal size ──
  const insightDonuts = [
    { key: 'status', title: t('analytics.statusTitle'), data: statusData, onPick: d => pickStatus(pickKey(d)),
      active: selectedStatus.length > 0, onClear: () => setSelectedStatus([]) },
    { key: 'funnel', title: t('analytics.funnelTitle'), data: funnelData, onPick: d => pickFunnel(pickKey(d)),
      active: selectedFunnel.length > 0, onClear: () => setSelectedFunnel([]) },
    { key: 'rc',     title: t('analytics.rcTitle'),     data: rcData,     onPick: d => pickOwner(pickKey(d)),
      active: selectedOwner.length > 0, onClear: () => setSelectedOwner([]) },
  ]
  const insightKpis = [
    { key: 'stale',      label: t('analytics.stale6m'),    value: staleCount,      sub: t('analytics.stale6mSub'),    color: 'var(--color-warning)',
      onClick: () => toggleAttention('stale6m'),    active: attentionFilter === 'stale6m' },
    { key: 'neverContacted', label: t('analytics.neverContacted'), value: neverContactedCount, sub: t('analytics.neverContactedSub'), color: '#0EA5E9',
      onClick: () => toggleAttention('neverContacted'), active: attentionFilter === 'neverContacted' },
    { key: 'noFollowup', label: t('analytics.noFollowup'), value: noFollowupCount, sub: t('analytics.noFollowupSub'), color: 'var(--color-danger)',
      onClick: () => toggleAttention('noFollowup'), active: attentionFilter === 'noFollowup' },
    { key: 'intake',     label: t('kpi.intake'),           value: intakeCount,     sub: t('kpi.intakeSub'),           color: '#8B5CF6',
      onClick: () => toggleOneValue(setSelectedFunnel, 'invited'), active: selectedFunnel.length === 1 && selectedFunnel[0] === 'invited' },
    { key: 'conversations', label: t('analytics.conversations'), value: activeConvCount, color: 'var(--color-success)', channels: [
      { label: 'WhatsApp Business', value: '–', color: '#25D366' },
      { label: 'WhatsApp Web',      value: '–', color: '#128C7E' },
      { label: 'E-mail',            value: '–', color: '#3B8FD4' },
    ] },
    { key: 'tasks', label: t('kpi.tasks'), value: tasksCount, sub: t('kpi.tasksSub'), color: '#0D9488' },
  ]

  return (
    <>
      {addOpen && <AddCandidateModal onClose={() => setAddOpen(false)} onCreated={handleCreated} />}
      <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

        {/* Table area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          <InsightsRow donuts={insightDonuts} kpis={insightKpis}
            clearTitle={t('analytics.clearFilter', { defaultValue: 'Filter wissen' })} />

          {/* Transient feedback for bulk mutations (aria-live for screen readers) */}
          {actionMsg && (
            <div role="status" aria-live="polite" style={{ margin: '0 24px 10px', display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 12px', borderRadius: 8, fontSize: 12.5,
              background: actionMsg.type === 'error' ? 'var(--color-danger-bg)' : 'var(--color-success-bg)',
              color: actionMsg.type === 'error' ? 'var(--color-danger)' : 'var(--color-success)',
              border: `1px solid ${actionMsg.type === 'error' ? 'var(--color-danger)' : 'var(--color-success)'}` }}>
              {actionMsg.type === 'error' ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
              <span style={{ flex: 1 }}>{actionMsg.text}</span>
              <button onClick={() => setActionMsg(null)} aria-label={t('close', { ns: 'common' })}
                style={{ display: 'flex', border: 'none', background: 'none', cursor: 'pointer', color: 'inherit', padding: 2 }}>
                <X size={13} />
              </button>
            </div>
          )}

          {/* Toolbar — bulk-bar zodra er selectie is, anders de toevoeg-knop */}
          <div style={{ padding: '0 24px 12px', display: 'flex', gap: 10, alignItems: 'center', minHeight: 36, flexShrink: 0 }}>
            {selectedIds.size > 0 ? (
              <CandidatesBulkBar count={selectedIds.size} onClear={() => setSelectedIds(new Set())}
                onAddToPool={bulkAddToPool} onRemoveFromPool={bulkRemoveFromPool}
                onSetOwner={bulkSetOwner} onSetStage={bulkSetStage} onSetTypes={bulkSetTypes}
                onRemoveTag={bulkRemoveTag} onAddNote={bulkAddNote} onArchive={bulkArchive}
                canArchive={hasPermission('candidates.delete')}
                users={users} funnelTypes={funnelTypes} candidateTypes={candidateTypes} selectedTags={selectedTags} />
            ) : (
              <button onClick={() => setAddOpen(true)} style={{ marginLeft: 'auto', padding: '7px 14px', fontSize: 12, fontWeight: 500,
                background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
                + {t('page.add')}
              </button>
            )}
          </div>

          {/* Table */}
          <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', padding: '0 24px 16px' }}>
            {error && (
              <div className="mb-3 rounded-lg px-3 py-2.5 text-sm text-red-600 bg-red-50 border border-red-200">
                {error}
              </div>
            )}
            <CandidatesTable
              rows={filtered}
              loading={loading}
              selectedId={selected?.id}
              onSelect={selectCandidate}
              selectable
              selectedIds={selectedIds}
              onToggleRow={toggleRow}
              onToggleAll={toggleAll}
              stickyHeader
            />
          </div>

          <PaginationBar
            page={page}
            totalPages={lastPage}
            totalRows={total}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={handlePageSizeChange}
          />
        </div>

        {/* Drawer — remounts (key) when the full detail arrives so the tabs
            re-initialise from the complete record instead of the light row. */}
        <CandidateDrawer
          key={selected ? `${selected.id}-${detail ? 'full' : 'lite'}` : 'none'}
          candidate={detail ?? selected}
          onClose={closeDrawer}
          expanded={drawerExpanded}
          onToggleExpand={() => setDrawerExpanded(v => !v)}
          onUpdate={updateCandidate}
          users={users}
        />
      </div>
    </>
  )
}
