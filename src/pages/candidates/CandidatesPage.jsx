import { useState, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useRightPanel } from '../../context/RightPanelContext'
import api from '../../lib/api'
import CandidateDrawer from './CandidateDrawer'
import AddCandidateModal from './AddCandidateModal'
import CandidatesTable from './CandidatesTable'
import CandidatesInsightsRow from './CandidatesInsightsRow'
import PaginationBar from '../../components/ui/PaginationBar'
import { mapCandidate } from './data/mapCandidate'
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
  const [page,            setPage]            = useState(1)
  const [pageSize,        setPageSize]        = useState(50)
  const [lastPage,        setLastPage]        = useState(1)
  const [total,           setTotal]           = useState(0)
  const [selected,        setSelected]        = useState(null)
  const [drawerExpanded,  setDrawerExpanded]  = useState(false)
  const [addOpen,         setAddOpen]         = useState(false)
  const [users,           setUsers]           = useState([])

  const [selectedStatus,      setSelectedStatus]      = useState([])
  const [selectedFunnel,      setSelectedFunnel]      = useState([])
  const [selectedType,        setSelectedType]        = useState([])
  const [selectedOwner,       setSelectedOwner]       = useState([])
  const [selectedBranches,   setSelectedVestiging]   = useState([])
  const [selectedGeslacht,    setSelectedGeslacht]    = useState([])
  const [selectedNationaliteit, setSelectedNationaliteit] = useState([])
  const [selectedProvince,    setSelectedProvince]    = useState([])
  const [selectedTitle,       setSelectedTitle]       = useState([])
  const [selectedSkills,      setSelectedSkills]      = useState([])
  const [selectedLanguages,   setSelectedLanguages]   = useState([])
  const [selectedCerts,       setSelectedCerts]       = useState([])
  const [selectedTags,        setSelectedTags]        = useState([])
  const [globalSearch,        setGlobalSearch]        = useState('')
  const [locationCity,        setLocationCity]        = useState('')
  const [locationRadius,      setLocationRadius]      = useState('')
  // Aandacht-tile filter: null | 'stale6m' | 'noFollowup' (klik = aan/uit).
  const [attentionFilter,     setAttentionFilter]     = useState(null)

  const { registerFilters, unregisterFilters } = useRightPanel()
  const { t } = useTranslation('candidates')
  const { candidateTypes, funnelTypes, statuses } = useLookups()

  const handlePageSizeChange = (newSize) => { setPageSize(newSize); setPage(1) }

  useEffect(() => {
    api.get('/candidates', { params: { page, per_page: pageSize } })
      .then(res => {
        const body = res.data
        const rows = Array.isArray(body) ? body : (body?.data ?? [])
        if (rows.length > 0) {
          setCandidates(rows.map(mapCandidate))
          setTotal(body?.meta?.total ?? body?.total ?? rows.length)
          setLastPage(body?.meta?.last_page ?? body?.last_page ?? 1)
        } else {
          setCandidates(DUMMY_CANDIDATES)
          setTotal(DUMMY_CANDIDATES.length)
          setLastPage(1)
        }
      })
      .catch(() => {
        setCandidates(DUMMY_CANDIDATES)
        setTotal(DUMMY_CANDIDATES.length)
        setLastPage(1)
      })
      .finally(() => setLoading(false))
  }, [page, pageSize])

  useEffect(() => {
    api.get('/users')
      .then(res => { const d = res.data; setUsers(Array.isArray(d) ? d : (d?.data ?? [])) })
      .catch(() => {})
  }, [])

  // Build {value,label,count} option lists from the loaded candidates.
  const optsFrom = (values, mapLabel = v => v) => {
    const counts = {}
    values.forEach(v => { counts[v] = (counts[v] ?? 0) + 1 })
    return Object.keys(counts).map(v => ({ value: v, label: mapLabel(v), count: counts[v] }))
  }

  // Lookup-driven options keep the config's order; only show values with matches.
  const statusOptions = useMemo(() =>
    statuses.map(s => ({ value: s.value, label: s.label, count: candidates.filter(c => c.status === s.value).length })).filter(o => o.count > 0)
  , [candidates, statuses])
  const funnelOptions = useMemo(() =>
    funnelTypes.map(f => ({ value: f.value, label: f.label, count: candidates.filter(c => c.stage === f.value).length })).filter(o => o.count > 0)
  , [candidates, funnelTypes])
  const typeOptions = useMemo(() =>
    candidateTypes.map(ct => ({ value: ct.value, label: ct.label, count: candidates.filter(c => (c.candidateTypes ?? []).includes(ct.value)).length })).filter(o => o.count > 0)
  , [candidates, candidateTypes])
  const ownerOptions        = useMemo(() => optsFrom(candidates.map(c => c.owner).filter(Boolean)), [candidates])
  const branchOptions    = useMemo(() => optsFrom(candidates.flatMap(c => c.branches ?? [])), [candidates])
  const geslachtOptions     = useMemo(() => optsFrom(candidates.map(c => c.gender).filter(v => v && v !== '-')), [candidates])
  const nationaliteitOptions= useMemo(() => optsFrom(candidates.map(c => c.nationality).filter(v => v && v !== '-')), [candidates])
  const provinceOptions     = useMemo(() => optsFrom(candidates.map(c => c.province).filter(Boolean)), [candidates])
  const titleOptions        = useMemo(() => optsFrom(candidates.map(c => c.title).filter(Boolean)), [candidates])
  const skillOptions        = useMemo(() => optsFrom(candidates.flatMap(c => c.skills ?? []).filter(Boolean)), [candidates])
  const languageOptions     = useMemo(() => optsFrom(candidates.flatMap(c => (c.languages ?? []).map(l => l.language ?? l).filter(Boolean))), [candidates])
  const certOptions         = useMemo(() => optsFrom(candidates.flatMap(c => (c.certifications ?? []).map(x => x.name ?? x).filter(Boolean))), [candidates])
  const tagOptions          = useMemo(() => optsFrom(candidates.flatMap(c => c.tags ?? [])), [candidates])

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

  const filterGroups = useMemo(() => [
    { key: 'global-search', type: 'global-search', label: t('filters.search'), placeholder: t('page.searchPlaceholder'), value: globalSearch, onChange: setGlobalSearch },
    { key: 'location',      type: 'location',      label: t('filters.radius'), city: locationCity, radius: locationRadius, onCityChange: setLocationCity, onRadiusChange: setLocationRadius },
    // ── Lifecycle ──
    { key: 'status',     type: 'search-select', category: catLifecycle, label: t('filters.status'),        selected: selectedStatus,   options: statusOptions, onToggle: tog(setSelectedStatus) },
    { key: 'funnel',     type: 'search-select', category: catLifecycle, label: t('filters.funnelType'),    selected: selectedFunnel,   options: funnelOptions, onToggle: tog(setSelectedFunnel) },
    { key: 'type',       type: 'search-select', category: catLifecycle, label: t('filters.candidateType'), selected: selectedType,     options: typeOptions,   onToggle: tog(setSelectedType) },
    // ── Kwalificaties ──
    { key: 'title',      type: 'search-select', category: catQualifications, label: t('filters.function'),       selected: selectedTitle,     options: titleOptions,    onToggle: tog(setSelectedTitle) },
    { key: 'skills',     type: 'search-select', category: catQualifications, label: t('filters.skills'),         selected: selectedSkills,    options: skillOptions,    onToggle: tog(setSelectedSkills) },
    { key: 'languages',  type: 'search-select', category: catQualifications, label: t('filters.languages'),      selected: selectedLanguages, options: languageOptions, onToggle: tog(setSelectedLanguages) },
    { key: 'certs',      type: 'search-select', category: catQualifications, label: t('filters.certifications'), selected: selectedCerts,     options: certOptions,     onToggle: tog(setSelectedCerts) },
    // ── Persoon ──
    { key: 'gender',        type: 'search-select', category: catPerson, label: t('filters.gender'),      selected: selectedGeslacht,      options: geslachtOptions,      onToggle: tog(setSelectedGeslacht) },
    { key: 'nationaliteit', type: 'search-select', category: catPerson, label: t('filters.nationality'), selected: selectedNationaliteit, options: nationaliteitOptions, onToggle: tog(setSelectedNationaliteit) },
    { key: 'province',      type: 'search-select', category: catPerson, label: t('filters.province'),    selected: selectedProvince,      options: provinceOptions,      onToggle: tog(setSelectedProvince) },
    // ── Organisatie ──
    { key: 'owner',    type: 'search-select', category: catOrganisation, label: t('filters.owner'),  selected: selectedOwner,    options: ownerOptions,  onToggle: tog(setSelectedOwner) },
    { key: 'branches', type: 'search-select', category: catOrganisation, label: t('filters.branch'), selected: selectedBranches, options: branchOptions, onToggle: tog(setSelectedVestiging) },
    { key: 'tags',     type: 'search-select', category: catOrganisation, label: t('filters.tags'),   selected: selectedTags,     options: tagOptions,    onToggle: tog(setSelectedTags) },
  ], [t, catLifecycle, catQualifications, catPerson, catOrganisation, globalSearch, locationCity, locationRadius,
      selectedStatus, selectedFunnel, selectedType, selectedTitle, selectedSkills, selectedLanguages, selectedCerts,
      selectedOwner, selectedBranches, selectedGeslacht, selectedNationaliteit, selectedProvince, selectedTags,
      statusOptions, funnelOptions, typeOptions, titleOptions, skillOptions, languageOptions, certOptions,
      ownerOptions, branchOptions, geslachtOptions, nationaliteitOptions, provinceOptions, tagOptions])

  useEffect(() => {
    registerFilters('candidates-page', filterGroups)
    return () => unregisterFilters('candidates-page')
  }, [filterGroups, registerFilters, unregisterFilters])

  const filtered = useMemo(() => {
    const q = globalSearch.trim().toLowerCase()
    return candidates.filter(c => {
      if (selectedStatus.length        && !selectedStatus.includes(c.status))                             return false
      if (selectedFunnel.length        && !selectedFunnel.includes(c.stage))                              return false
      if (selectedType.length          && !selectedType.some(v => (c.candidateTypes ?? []).includes(v)))   return false
      if (selectedTitle.length         && !selectedTitle.includes(c.title))                               return false
      if (selectedOwner.length         && !selectedOwner.includes(c.owner))                               return false
      if (selectedBranches.length     && !selectedBranches.some(v => (c.branches ?? []).includes(v))) return false
      if (selectedGeslacht.length      && !selectedGeslacht.includes(c.gender))                           return false
      if (selectedNationaliteit.length && !selectedNationaliteit.includes(c.nationality))                 return false
      if (selectedProvince.length      && !selectedProvince.includes(c.province))                         return false
      if (selectedSkills.length        && !selectedSkills.some(v => (c.skills ?? []).includes(v)))        return false
      if (selectedLanguages.length     && !selectedLanguages.some(v => (c.languages ?? []).some(l => (l.language ?? l) === v))) return false
      if (selectedCerts.length         && !selectedCerts.some(v => (c.certifications ?? []).some(x => (x.name ?? x) === v)))    return false
      if (selectedTags.length          && !selectedTags.some(t => (c.tags ?? []).includes(t)))           return false
      if (attentionFilter === 'stale6m'    && !isStale(c))       return false
      if (attentionFilter === 'noFollowup' && !isNoFollowup(c))  return false
      if (q) {
        const haystack = [
          c.name, c.title, c.email, c.phone, c.address, c.status, c.owner,
          c.gender, c.nationality, c.dob, c.summary,
          ...(c.tags ?? []),
          ...(c.branches ?? []),
          ...(c.notes ?? []).map(n => `${n.title ?? ''} ${n.text ?? n.body ?? ''}`),
          ...(c.documents ?? []).map(d => d.name ?? d.file_name ?? ''),
          ...(c.experiences ?? []).map(e => `${e.title ?? ''} ${e.company ?? ''}`),
          ...(c.educations ?? []).map(o => `${o.title ?? ''} ${o.school ?? ''}`),
        ].join(' ').toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [candidates, globalSearch, selectedStatus, selectedFunnel, selectedType, selectedTitle, selectedSkills, selectedLanguages, selectedCerts,
      selectedOwner, selectedBranches, selectedGeslacht, selectedNationaliteit, selectedProvince, selectedTags, attentionFilter])

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

    // Translate the UI patch → API keys (3-layer model) and persist.
    const body = {}
    if ('candidateTypes' in patch) body.candidate_types = patch.candidateTypes
    if ('status'         in patch) body.status          = patch.status
    if ('stage'          in patch) body.funnel_type     = patch.stage
    if (Object.keys(body).length) api.patch(`/candidates/${id}`, body).catch(() => {})
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

          {/* Toolbar */}
          <div style={{ padding: '0 24px 12px', display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
            <button onClick={() => setAddOpen(true)} style={{ marginLeft: 'auto', padding: '7px 14px', fontSize: 12, fontWeight: 500,
              background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
              + {t('page.add')}
            </button>
          </div>

          {/* Table */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 16px' }}>
            <CandidatesTable
              rows={filtered}
              loading={loading}
              selectedId={selected?.id}
              onSelect={selectCandidate}
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
