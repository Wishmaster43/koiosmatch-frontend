import { useState, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useRightPanel } from '../../context/RightPanelContext'
import api, { unwrapList } from '../../lib/api'
import { useUsers } from '../../lib/queries'
import { USE_MOCKS, isAbortError } from '../../lib/mocks'
import CandidateDrawer from './CandidateDrawer'
import AddCandidateModal from './AddCandidateModal'
import CandidatesTable from './CandidatesTable'
import CandidatesBulkBar from './CandidatesBulkBar'
import CandidatesInsightsRow from './CandidatesInsightsRow'
import PaginationBar from '../../components/ui/PaginationBar'
import { mapCandidate } from './data/mapCandidate'
import { NL_PROVINCES } from './drawer/constants'
import { useLookups } from '../../context/LookupsContext'

// ── Aandacht-predicaten (één bron voor zowel de tellingen als het filter) ──
const SIX_MONTHS_MS = 182 * 86400000
// Niet benaderd > 6 mnd: nooit benaderd, of laatste contact langer dan 6 mnd geleden.
const isStale = (c) => {
  const t = c.lastContactAt ? new Date(c.lastContactAt).getTime() : null
  return t == null || (Date.now() - t) > SIX_MONTHS_MS
}
// Geen opvolging: nieuwe prospect zonder enig contact.
const isNoFollowup = (c) => c.stage === 'prospect' && !c.lastContactAt

// Zet precies één waarde in een multi-select, of wis bij nogmaals dezelfde (toggle).
// Module-scope zodat het een stabiele referentie is (geen memo-dependency nodig).
const toggleOneValue = (set, value) =>
  set(p => (p.length === 1 && p[0] === value) ? [] : [value])

// Temporary dummy data — replace once API returns candidates
const DUMMY_CANDIDATES = [
  { id: 1,  name: 'Ismail Eddahchouri',    initials: 'IE', title: 'Verzorgende IG',  candidateTypes: ['on_call'],        stage: 'pool', status: 'active',     statusColor: 'var(--color-success)',   owner: 'Wiktoria Opalenyk', ownerInitials: 'WO', city: 'Papendrecht', province: 'Zuid-Holland', lastContactAt: '2026-06-09', client: 'Stichting Rivas Zorggroep', created: '12 jun 2026', email: 'i-s-m-a-i-l2007@outlook.com', phone: '+31624159406', address: 'Papendrecht', gender: 'Man',   nationality: 'Marokkaans',  dob: '15 maart 1995 (31 jaar)', summary: 'Verzorgende IG met ruime experiences in de ouderenzorg.', tags: ['Papendrecht', 'Verzorging', 'IG', 'MBO'], branches: ['Koios flex B.V.', 'Koios zorg B.V.'], experiences: [{ id: 1, title: 'Verzorgende IG', company: 'Stichting Rivas Zorggroep', location: 'Papendrecht', period: 'jan 2022–heden', desc: 'Via KoiosMatch' }, { id: 2, title: 'Helpende', company: 'Verpleeghuis Oudshoorn, Alrijne', location: 'Oudshoorn', period: 'jul 2020–dec 2021', desc: '' }], educations: [{ id: 1, title: 'MBO 4, Verzorgende IG', school: 'ROC Mondriaan', period: 'Uitgegeven jan 2022' }, { id: 2, title: 'VMBO Kader', school: 'Dongemond College', period: 'Uitgegeven jun 2018' }], languages: [{ id: 1, language: 'Nederlands', spoken: 'Goed', written: 'Goed' }], certifications: [], skills: ['Rijbewijs B', 'BHV'], documents: [{ name: 'CV_Ismail.pdf', size: '44856' }], applications: [], notes: [{ author: 'Wiktoria Opalenyk', ago: '1 week geleden', text: 'Kandidaat heeft interesse in vaste dienst.' }] },
  { id: 2,  name: 'Merel Van Muijlwijk',   initials: 'MV', title: 'Helpende',        candidateTypes: ['freelance'],         stage: 'pool', status: 'active',     statusColor: 'var(--color-success)',   owner: 'Wiktoria Opalenyk', ownerInitials: 'WO', city: 'Utrecht',     province: 'Utrecht', lastContactAt: '2026-06-12', client: 'Stichting Rivas Zorggroep', created: '12 jun 2026', email: 'merel.vm@gmail.com', phone: '+31612345678', address: 'Herenhof 12, 3500 AA, Utrecht', gender: 'Vrouw', nationality: 'Nederlands', dob: '22 juli 1998 (27 jaar)', summary: 'Helpende met experiences in woonzorg.', tags: ['Utrecht', 'HR medewerker', 'MBO', 'Senior'], branches: ['Koios flex B.V.', 'Koios zorg B.V.', 'Koios works B.V.'], experiences: [{ id: 1, title: 'ZZP Helpende', company: 'Verpleeghuis Oudshoorn, Alrijne', location: 'Oudshoorn', period: 'jul 2022–sep 2024', desc: 'Via Yesway' }], educations: [{ id: 1, title: 'MBO 2, Helpende Zorg & Welzijn', school: 'Regionaal Opleidingen Centrum Gouda', period: 'Uitgegeven jan 2015' }], languages: [{ id: 1, language: 'Nederlands', spoken: 'Goed', written: 'Goed' }], certifications: [], skills: ['Rijbewijs B'], documents: [{ name: 'Merel Van Muijlwijk - CV.pdf', size: '495516' }], applications: [], notes: [{ author: 'Danny Polak', ago: '2 maanden geleden', text: 'Beschikbaar vanaf: 16-08-2024\nUren per week: 24-32' }] },
  { id: 3,  name: 'Raginie Rasoelbaks',    initials: 'RR', title: 'Verpleegkundige', candidateTypes: ['payroll'], stage: 'intake', status: 'intake',    statusColor: 'var(--color-warning)',   owner: 'Wiktoria Opalenyk', ownerInitials: 'WO', city: 'Rotterdam',   province: 'Zuid-Holland', lastContactAt: '2026-06-10', client: '',                         created: '12 jun 2026', email: 'raginie.r@hotmail.com',   phone: '+31687654321', address: 'Rotterdam',  gender: 'Vrouw', nationality: 'Surinaams',   dob: '4 nov 1993 (32 jaar)',  summary: '', tags: ['Rotterdam'],          branches: ['Koios zorg B.V.'],  experiences: [], educations: [], languages: [], certifications: [], skills: [], documents: [], applications: [], notes: [] },
  { id: 4,  name: 'Elif Akagündüz',        initials: 'EA', title: 'Gastvrouw',       candidateTypes: ['on_call'],        stage: 'prospect', status: 'active',     statusColor: 'var(--color-success)',   owner: 'Kelly van Vliet',   ownerInitials: 'KV', city: 'Amsterdam',   province: 'Noord-Holland', lastContactAt: '2026-06-05', client: 'Yesway Zorg',            created: '12 jun 2026', email: 'elif.ak@gmail.com',       phone: '+31698765432', address: 'Amsterdam', gender: 'Vrouw', nationality: 'Turks',       dob: '30 mei 2000 (25 jaar)', summary: '', tags: ['Amsterdam', 'MBO'],   branches: ['Koios zorg B.V.'],  experiences: [], educations: [], languages: [], certifications: [], skills: [], documents: [], applications: [], notes: [] },
  { id: 5,  name: 'Dina [Niet opgegeven]', initials: 'DI', title: '',                candidateTypes: [],            stage: 'prospect', status: 'active',     statusColor: 'var(--color-success)',   owner: 'Wiktoria Opalenyk', ownerInitials: 'WO', city: '',             province: '', lastContactAt: null,         client: '',                         created: '12 jun 2026', email: '-',               phone: '-',            address: '-',         gender: '-',   nationality: '-',           dob: '-',                     summary: '', tags: [],                    branches: [],                   experiences: [], educations: [], languages: [], certifications: [], skills: [], documents: [], applications: [], notes: [] },
  { id: 6,  name: 'Figen Ooijevaar',       initials: 'FO', title: 'Zorgmedewerker', candidateTypes: ['on_call'],        stage: 'prospect', status: 'prospect', statusColor: 'var(--color-primary)',   owner: 'Wiktoria Opalenyk', ownerInitials: 'WO', city: 'Den Haag',    province: 'Zuid-Holland', lastContactAt: '2026-06-11', client: '',                         created: '11 jun 2026', email: 'figen.o@gmail.com',       phone: '+31645678901', address: 'Den Haag',  gender: 'Vrouw', nationality: 'Nederlands',  dob: '18 sep 1996 (29 jaar)', summary: '', tags: ['Den Haag'],          branches: ['Koios zorg B.V.'],  experiences: [], educations: [], languages: [], certifications: [], skills: [], documents: [], applications: [], notes: [] },
  { id: 7,  name: 'Fernanda Vogel-Andrade',initials: 'FV', title: 'Helpende',        candidateTypes: ['freelance'],         stage: 'pool', status: 'active',     statusColor: 'var(--color-success)',   owner: 'Wiktoria Opalenyk', ownerInitials: 'WO', city: 'Eindhoven',   province: 'Noord-Brabant', lastContactAt: '2026-06-03', client: '',                         created: '11 jun 2026', email: 'fernanda.va@gmail.com',   phone: '+31623456789', address: 'Eindhoven', gender: 'Vrouw', nationality: 'Braziliaans', dob: '11 feb 1994 (31 jaar)', summary: '', tags: ['Eindhoven', 'MBO'],  branches: [],                   experiences: [], educations: [], languages: [], certifications: [], skills: [], documents: [], applications: [], notes: [] },
  { id: 8,  name: 'Rubina Rosella Milan',  initials: 'RM', title: 'Verzorgende',     candidateTypes: ['payroll'], stage: 'intake', status: 'intake',  statusColor: 'var(--color-secondary)', owner: 'Kelly van Vliet',   ownerInitials: 'KV', city: 'Breda',       province: 'Noord-Brabant', lastContactAt: '2026-06-08', client: 'Stichting WoonzorgGroep', created: '11 jun 2026', email: 'rubina.rm@outlook.com',   phone: '+31678901234', address: 'Breda',     gender: 'Vrouw', nationality: 'Nederlands',  dob: '25 dec 1991 (34 jaar)', summary: '', tags: ['Breda', 'Verzorging'], branches: ['Koios zorg B.V.'],  experiences: [], educations: [], languages: [], certifications: [], skills: [], documents: [], applications: [], notes: [] },
  { id: 9,  name: 'Priscilla Benjamin',    initials: 'PB', title: 'Verpleegkundige', candidateTypes: ['on_call'],        stage: 'prospect', status: 'prospect', statusColor: 'var(--color-primary)',   owner: 'Bente de Jong',     ownerInitials: 'BD', city: 'Tilburg',     province: 'Noord-Brabant', lastContactAt: null,         client: '',                         created: '11 jun 2026', email: 'p.benjamin@gmail.com',    phone: '+31634567890', address: 'Tilburg',   gender: 'Vrouw', nationality: 'Surinaams',   dob: '7 aug 1997 (28 jaar)',  summary: '', tags: ['Tilburg'],           branches: [],                   experiences: [], educations: [], languages: [], certifications: [], skills: [], documents: [], applications: [], notes: [] },
  { id: 10, name: 'Petra Kuiters',         initials: 'PK', title: 'Helpende',        candidateTypes: ['freelance'],         stage: 'prospect', status: 'prospect', statusColor: 'var(--color-primary)',   owner: 'Bente de Jong',     ownerInitials: 'BD', city: 'Groningen',   province: 'Groningen', lastContactAt: '2026-05-28', client: '',                         created: '11 jun 2026', email: 'petra.k@hotmail.com',     phone: '+31656789012', address: 'Groningen', gender: 'Vrouw', nationality: 'Nederlands',  dob: '14 apr 1989 (37 jaar)', summary: '', tags: ['Groningen', 'Senior'], branches: [],                   experiences: [], educations: [], languages: [], certifications: [], skills: [], documents: [], applications: [], notes: [] },
]

export default function CandidatesPage() {
  const [candidates,      setCandidates]      = useState([])
  const [loading,         setLoading]         = useState(true)
  const [error,           setError]           = useState(null)
  const [page,            setPage]            = useState(1)
  const [pageSize,        setPageSize]        = useState(50)
  const [lastPage,        setLastPage]        = useState(1)
  const [total,           setTotal]           = useState(0)
  const [selected,        setSelected]        = useState(null)
  const [drawerExpanded,  setDrawerExpanded]  = useState(false)
  const [addOpen,         setAddOpen]         = useState(false)
  const { data: users = [] } = useUsers()

  // Server-side filter dimensions (the API supports these). Owner holds owner_ids.
  const [selectedStatus,   setSelectedStatus]   = useState([])
  const [selectedFunnel,   setSelectedFunnel]   = useState([])
  const [selectedType,     setSelectedType]     = useState([])
  const [selectedOwner,    setSelectedOwner]    = useState([])
  const [selectedGeslacht, setSelectedGeslacht] = useState([])
  const [selectedProvince, setSelectedProvince] = useState([])
  const [selectedTitle,    setSelectedTitle]    = useState([])
  const [globalSearch,     setGlobalSearch]     = useState('')
  // Aandacht-tile filter: null | 'stale6m' | 'noFollowup' (klik = aan/uit).
  const [attentionFilter,  setAttentionFilter]  = useState(null)
  // Echte tellingen voor de charts/opties (GET /candidates/stats).
  const [stats,            setStats]            = useState(null)
  // Bulk-selectie (checkboxes) — id-set; wordt gewist bij filter/pagina-wissel.
  const [selectedIds,      setSelectedIds]      = useState(() => new Set())

  const { registerFilters, unregisterFilters } = useRightPanel()
  const { t } = useTranslation('candidates')
  const { candidateTypes, funnelTypes, statuses } = useLookups()

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
    return p
  }, [globalSearch, selectedStatus, selectedFunnel, selectedType, selectedOwner, selectedGeslacht, selectedProvince, selectedTitle])
  const filterKey = JSON.stringify(filterParams)

  // Filters changed → back to page 1 (the filtered set has its own pagination).
  useEffect(() => { setPage(1) }, [filterKey])
  // The visible rows change with the filter/page → drop the bulk selection.
  useEffect(() => { setSelectedIds(new Set()) }, [filterKey, page, pageSize])

  // ── List (paginated, server-filtered) ──
  useEffect(() => {
    const ctrl = new AbortController()
    setLoading(true)
    setError(null)
    api.get('/candidates', { params: { ...filterParams, page, per_page: pageSize }, signal: ctrl.signal })
      .then(res => {
        const { rows, total, lastPage } = unwrapList(res)
        if (rows.length === 0 && USE_MOCKS) {
          setCandidates(DUMMY_CANDIDATES); setTotal(DUMMY_CANDIDATES.length); setLastPage(1)
        } else {
          setCandidates(rows.map(mapCandidate)); setTotal(total); setLastPage(lastPage)
        }
      })
      .catch(err => {
        if (isAbortError(err)) return
        if (USE_MOCKS) {
          setCandidates(DUMMY_CANDIDATES); setTotal(DUMMY_CANDIDATES.length); setLastPage(1)
        } else {
          setError(t('page.loadError', { defaultValue: 'Kandidaten laden is mislukt.' }))
          setCandidates([]); setTotal(0); setLastPage(1)
        }
      })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false) })
    return () => ctrl.abort()
  }, [filterParams, page, pageSize, t])

  // ── Stats (real totals across the whole filtered set, not just the page) ──
  // Depends only on the filters, not on pagination. Falls back to page-based
  // counts (below) when the endpoint isn't available yet.
  useEffect(() => {
    const ctrl = new AbortController()
    api.get('/candidates/stats', { params: filterParams, signal: ctrl.signal })
      .then(res => setStats(res.data?.data ?? res.data ?? null))
      .catch(err => { if (!isAbortError(err)) setStats(null) })
    return () => ctrl.abort()
  }, [filterParams])

  // Build {value,label,count} option lists from the loaded candidates.
  const optsFrom = (values, mapLabel = v => v) => {
    const counts = {}
    values.forEach(v => { counts[v] = (counts[v] ?? 0) + 1 })
    return Object.keys(counts).map(v => ({ value: v, label: mapLabel(v), count: counts[v] }))
  }

  const metaOf = (list, v) => list.find(x => x.value === v)

  // Status / funnel / owner options come from stats (whole filtered set); fall
  // back to page-based counts when stats is unavailable.
  const statusOptions = useMemo(() =>
    stats?.by_status
      ? stats.by_status.map(o => ({ value: o.value, label: metaOf(statuses, o.value)?.label ?? o.value, count: o.count }))
      : statuses.map(s => ({ value: s.value, label: s.label, count: candidates.filter(c => c.status === s.value).length })).filter(o => o.count > 0)
  , [stats, candidates, statuses])
  const funnelOptions = useMemo(() =>
    stats?.by_funnel
      ? stats.by_funnel.map(o => ({ value: o.value, label: metaOf(funnelTypes, o.value)?.label ?? o.value, count: o.count }))
      : funnelTypes.map(f => ({ value: f.value, label: f.label, count: candidates.filter(c => c.stage === f.value).length })).filter(o => o.count > 0)
  , [stats, candidates, funnelTypes])
  const typeOptions = useMemo(() =>
    candidateTypes.map(ct => ({ value: ct.value, label: ct.label, count: candidates.filter(c => (c.candidateTypes ?? []).includes(ct.value)).length })).filter(o => o.count > 0)
  , [candidates, candidateTypes])
  // Owner is id-based: options + counts from stats.by_owner; fall back to the
  // loaded page keyed on ownerId.
  const ownerOptions = useMemo(() => {
    if (stats?.by_owner) {
      // Drop the "no owner" bucket (null id) and guard against a null name.
      return stats.by_owner.filter(o => o.id).map(o => ({ value: o.id, label: o.name || '—', count: o.count }))
    }
    const m = {}
    candidates.forEach(c => { if (c.ownerId) (m[c.ownerId] ??= { value: c.ownerId, label: c.owner || '—', count: 0 }).count++ })
    return Object.values(m)
  }, [stats, candidates])
  // Server-side filters whose option-lists aren't in stats: gender + province
  // use fixed lists; title is page-derived until a dedicated options endpoint.
  const genderOptions   = useMemo(() => [
    { value: 'male',   label: t('modal.gender.male') },
    { value: 'female', label: t('modal.gender.female') },
    { value: 'other',  label: t('modal.gender.other') },
  ], [t])
  const provinceOptions = useMemo(() => NL_PROVINCES.map(p => ({ value: p, label: p })), [])
  const titleOptions    = useMemo(() => optsFrom(candidates.map(c => c.title).filter(Boolean)), [candidates])

  const tog = (set) => (v) => set(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v])

  // Klik-op-chart → zet precies één waarde, of wis bij nogmaals klikken (toggle).
  const pickOne = (set) => (v) => { if (v != null) toggleOneValue(set, v) }

  // Donut-data: hergebruik de tel-opties, verrijk met de lookup-kleur per waarde.
  const colorFor = (list, v) => list.find(x => x.value === v)?.color
  const statusData = useMemo(() =>
    statusOptions.map(o => ({ name: o.label, value: o.count, key: o.value, color: colorFor(statuses, o.value) }))
  , [statusOptions, statuses])
  const funnelData = useMemo(() =>
    funnelOptions.map(o => ({ name: o.label, value: o.count, key: o.value, color: colorFor(funnelTypes, o.value) }))
  , [funnelOptions, funnelTypes])
  const rcData = useMemo(() =>
    ownerOptions.map(o => ({ name: o.label, value: o.count, key: o.value }))
  , [ownerOptions])

  // Aandacht-tellingen (zelfde predicaten als het filter hieronder).
  const staleCount      = useMemo(() => candidates.filter(isStale).length, [candidates])
  const noFollowupCount = useMemo(() => candidates.filter(isNoFollowup).length, [candidates])
  const toggleAttention = (key) => setAttentionFilter(prev => prev === key ? null : key)
  const pickStatus = pickOne(setSelectedStatus)
  const pickFunnel = pickOne(setSelectedFunnel)
  const pickOwner  = pickOne(setSelectedOwner)

  const catLifecycle      = t('filters.categories.lifecycle')
  const catQualifications = t('filters.categories.qualifications')
  const catPerson         = t('filters.categories.person')
  const catOrganisation   = t('filters.categories.organisation')

  // Only the dimensions the API filters server-side. tags/skills/languages/certs
  // (sub-table joins) + radius (needs geocoding) are hidden until a later round.
  const filterGroups = useMemo(() => [
    { key: 'global-search', type: 'global-search', label: t('filters.search'), placeholder: t('page.searchPlaceholder'), value: globalSearch, onChange: setGlobalSearch },
    // ── Lifecycle ──
    { key: 'status', type: 'search-select', category: catLifecycle, label: t('filters.status'),        selected: selectedStatus, options: statusOptions, onToggle: tog(setSelectedStatus) },
    { key: 'funnel', type: 'search-select', category: catLifecycle, label: t('filters.funnelType'),    selected: selectedFunnel, options: funnelOptions, onToggle: tog(setSelectedFunnel) },
    { key: 'type',   type: 'search-select', category: catLifecycle, label: t('filters.candidateType'), selected: selectedType,   options: typeOptions,   onToggle: tog(setSelectedType) },
    // ── Kwalificaties ──
    { key: 'title',  type: 'search-select', category: catQualifications, label: t('filters.function'), selected: selectedTitle, options: titleOptions, onToggle: tog(setSelectedTitle) },
    // ── Persoon ──
    { key: 'gender',   type: 'search-select', category: catPerson, label: t('filters.gender'),   selected: selectedGeslacht, options: genderOptions,   onToggle: tog(setSelectedGeslacht) },
    { key: 'province', type: 'search-select', category: catPerson, label: t('filters.province'), selected: selectedProvince, options: provinceOptions, onToggle: tog(setSelectedProvince) },
    // ── Organisatie ──
    { key: 'owner', type: 'search-select', category: catOrganisation, label: t('filters.owner'), selected: selectedOwner, options: ownerOptions, onToggle: tog(setSelectedOwner) },
  ], [t, catLifecycle, catQualifications, catPerson, catOrganisation, globalSearch,
      selectedStatus, selectedFunnel, selectedType, selectedTitle, selectedGeslacht, selectedProvince, selectedOwner,
      statusOptions, funnelOptions, typeOptions, titleOptions, genderOptions, provinceOptions, ownerOptions])

  useEffect(() => {
    registerFilters('candidates-page', filterGroups)
    return () => unregisterFilters('candidates-page')
  }, [filterGroups, registerFilters, unregisterFilters])

  // All real filters run server-side now; the only client-side refinement left is
  // the attention tile (its predicate isn't a server filter yet). The loaded page
  // is already the server-filtered + paginated slice.
  const filtered = useMemo(() => {
    if (!attentionFilter) return candidates
    const pred = attentionFilter === 'stale6m' ? isStale : isNoFollowup
    return candidates.filter(pred)
  }, [candidates, attentionFilter])

  // The list row is intentionally light; on open we fetch the full record
  // (GET /candidates/{id}) and hand THAT to the drawer. `detail` overrides the
  // row once loaded; the ref guards against an out-of-order response when the
  // user clicks through candidates quickly. In dummy mode the GET 404s and the
  // drawer simply keeps the (already populated) dummy row.
  const [detail, setDetail] = useState(null)
  const selectedIdRef = useRef(null)

  const selectCandidate = (c) => {
    selectedIdRef.current = c.id
    setSelected(c); setDetail(null); setDrawerExpanded(false)
    api.get(`/candidates/${c.id}`)
      .then(r => { if (selectedIdRef.current === c.id) setDetail(mapCandidate(r.data?.data ?? r.data)) })
      .catch(() => {})
  }

  const closeDrawer = () => { selectedIdRef.current = null; setSelected(null); setDetail(null); setDrawerExpanded(false) }

  // A freshly created candidate: prepend to the list and open its drawer (which
  // then fetches the full detail). The API already returned the mapped record.
  const handleCreated = (c) => {
    setCandidates(prev => [c, ...prev])
    setTotal(prev => prev + 1)
    setAddOpen(false)
    selectCandidate(c)
  }

  // Header edits in the drawer (candidate type, status, funnel) flow back here so
  // the table + charts update live: optimistic locally, then PATCH the API.
  const updateCandidate = (id, patch) => {
    setCandidates(prev => prev.map(x => x.id === id ? { ...x, ...patch } : x))
    setSelected(prev => (prev && prev.id === id ? { ...prev, ...patch } : prev))
    setDetail(prev  => (prev && prev.id === id ? { ...prev, ...patch } : prev))

    // Translate the UI patch → API keys (3-layer model + header fields) and persist.
    const body = {}
    if ('candidateTypes' in patch) body.candidate_types = patch.candidateTypes
    if ('status'         in patch) body.status          = patch.status
    if ('stage'          in patch) body.funnel_type     = patch.stage
    if ('firstname'      in patch) body.first_name      = patch.firstname
    if ('lastname'       in patch) body.last_name       = patch.lastname
    if ('middleName'     in patch) body.middle_name     = patch.middleName
    if ('title'          in patch) body.function_title  = patch.title
    // Profile-tab fields (drawer) → API keys. Backend saves what it validates.
    if ('gender'            in patch) body.gender            = patch.gender
    if ('nationality'       in patch) body.nationality       = patch.nationality
    if ('dob'               in patch) body.date_of_birth     = patch.dob
    if ('email'             in patch) body.email             = patch.email
    if ('phone'             in patch) body.phone             = patch.phone
    if ('street'            in patch) body.street            = patch.street
    if ('houseNumber'       in patch) body.house_number      = patch.houseNumber
    if ('houseNumberSuffix' in patch) body.house_number_suffix = patch.houseNumberSuffix
    if ('postalCode'        in patch) body.postcode          = patch.postalCode
    if ('city'              in patch) body.city              = patch.city
    if ('province'          in patch) body.province          = patch.province
    if ('linkedin'          in patch) body.linkedin_slug     = patch.linkedin
    if ('summary'           in patch) body.summary           = patch.summary
    if ('languages'         in patch) body.languages         = patch.languages
    if (Object.keys(body).length) api.patch(`/candidates/${id}`, body).catch(() => {})
  }

  // ── Bulk selection ──
  const toggleRow = (id) => setSelectedIds(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })
  const toggleAll = (ids, allSelected) => setSelectedIds(prev => {
    const next = new Set(prev)
    ids.forEach(id => allSelected ? next.delete(id) : next.add(id))
    return next
  })
  const bulkAddToPool = (poolId) => {
    const ids = [...selectedIds]
    if (ids.length) api.post(`/pools/${poolId}/candidates`, { candidate_ids: ids }).catch(() => {})
    setSelectedIds(new Set())
  }
  const bulkRemoveFromPool = (poolId) => {
    const ids = [...selectedIds]
    if (ids.length) api.delete(`/pools/${poolId}/candidates`, { data: { candidate_ids: ids } }).catch(() => {})
    setSelectedIds(new Set())
  }

  // Recharts hands the clicked segment back at top level AND under `.payload`.
  const pickKey = (d) => d?.key ?? d?.payload?.key ?? d?.name

  const intakeCount = useMemo(() => candidates.filter(c => c.status === 'intake').length, [candidates])
  // Proxy for "active conversations" until the backend exposes WhatsApp/e-mail
  // threads: candidates contacted in the last 14 days. Channel split TBD.
  // Cutoff captured once at mount (lazy init) so the memo stays pure.
  const [convCutoff] = useState(() => Date.now() - 14 * 86400000)
  const activeConvCount = useMemo(() =>
    candidates.filter(c => c.lastContactAt && new Date(c.lastContactAt).getTime() > convCutoff).length
  , [candidates, convCutoff])

  // ── One strip: 3 donuts + 4 KPI cards, all equal size ──
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
    { key: 'noFollowup', label: t('analytics.noFollowup'), value: noFollowupCount, sub: t('analytics.noFollowupSub'), color: 'var(--color-danger)',
      onClick: () => toggleAttention('noFollowup'), active: attentionFilter === 'noFollowup' },
    { key: 'intake',     label: t('kpi.intake'),           value: intakeCount,     sub: t('kpi.intakeSub'),           color: '#8B5CF6',
      onClick: () => toggleOneValue(setSelectedStatus, 'intake'), active: selectedStatus.length === 1 && selectedStatus[0] === 'intake' },
    { key: 'conversations', label: t('analytics.conversations'), value: activeConvCount, color: 'var(--color-success)', channels: [
      { label: 'WhatsApp Business', value: '–', color: '#25D366' },
      { label: 'WhatsApp Web',      value: '–', color: '#128C7E' },
      { label: 'E-mail',            value: '–', color: '#3B8FD4' },
    ] },
  ]

  return (
    <>
      {addOpen && <AddCandidateModal onClose={() => setAddOpen(false)} onCreated={handleCreated} />}
      <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

        {/* Table area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Eén compacte strip: donuts + KPI's, allemaal gelijke grootte op 1 regel */}
          <CandidatesInsightsRow donuts={insightDonuts} kpis={insightKpis} />

          {/* Toolbar — bulk-bar zodra er selectie is, anders de toevoeg-knop */}
          <div style={{ padding: '0 24px 12px', display: 'flex', gap: 10, alignItems: 'center', minHeight: 36, flexShrink: 0 }}>
            {selectedIds.size > 0 ? (
              <CandidatesBulkBar count={selectedIds.size} onClear={() => setSelectedIds(new Set())}
                onAddToPool={bulkAddToPool} onRemoveFromPool={bulkRemoveFromPool} />
            ) : (
              <button onClick={() => setAddOpen(true)} style={{ marginLeft: 'auto', padding: '7px 14px', fontSize: 12, fontWeight: 500,
                background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
                + {t('page.add')}
              </button>
            )}
          </div>

          {/* Table */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 16px' }}>
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
